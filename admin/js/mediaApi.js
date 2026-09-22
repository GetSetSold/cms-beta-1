// Media helpers shared by the Media view and the block editor's image picker.
//
// ASSUMED images columns: id, path (object key inside the `media` storage
// bucket), name, mime_type, size_bytes, created_at.
// Links live ONLY in image_assignments(image_id, related_type, related_id).

import { getSupabase } from "./supabase.js";

const BUCKET = "media";

export async function listImages() {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("images")
    .select("id, path, name, mime_type, size_bytes, created_at, image_assignments(related_type, related_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function publicImageUrl(path) {
  const sb = await getSupabase();
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Cached image list with public URLs (used by the media grid and the
// block-editor image picker). Invalidated on upload/delete.
let imageCache = null;

export async function listImagesWithUrls() {
  if (!imageCache) {
    const imgs = await listImages();
    imageCache = await Promise.all(imgs.map(async (img) => ({ ...img, url: await publicImageUrl(img.path) })));
  }
  return imageCache;
}

export function invalidateImageCache() {
  imageCache = null;
}

export async function uploadImage(file, assignment = {}) {
  const sb = await getSupabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${safeName}`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: row, error: rowErr } = await sb
    .from("images")
    .insert({
      path,
      name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size || null,
    })
    .select("id")
    .single();
  if (rowErr) {
    await sb.storage.from(BUCKET).remove([path]);
    throw rowErr;
  }

  if (assignment.related_type) {
    const { error: asgErr } = await sb.from("image_assignments").insert({
      image_id: row.id,
      related_type: assignment.related_type,
      related_id: assignment.related_id || null,
    });
    if (asgErr) throw asgErr;
  }
  invalidateImageCache();
  return row.id;
}

export async function deleteImage(id, path) {
  const sb = await getSupabase();
  // Assignments cascade on delete (FK ON DELETE CASCADE), but remove explicitly
  // in case constraints aren't validated yet.
  await sb.from("image_assignments").delete().eq("image_id", id);
  const { error: rowErr } = await sb.from("images").delete().eq("id", id);
  if (rowErr) throw rowErr;
  if (path) {
    const { error: stErr } = await sb.storage.from(BUCKET).remove([path]);
    if (stErr) throw stErr;
  }
  invalidateImageCache();
}

export const RELATED_TYPES = ["project", "builder", "home_model", "floorplan", "phase", "promo", "page", "block"];
