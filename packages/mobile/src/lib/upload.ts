import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { getStoragePath, getContentType } from '@upoe/shared';
import type { StorageBucket } from '@upoe/shared';

/**
 * Pick an image from the device library and upload it to Supabase Storage.
 *
 * @param bucket - Storage bucket name (e.g., 'payment-proofs')
 * @param communityId - Community ID for path scoping
 * @param category - Sub-category for organization (e.g., 'receipts', 'incidents')
 * @returns The uploaded object path within the bucket, or null if canceled/failed
 */
export async function pickAndUploadImage(
  bucket: string,
  communityId: string,
  category: string
): Promise<string | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    const uri = asset.uri;
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);

    const path = getStoragePath(
      bucket as StorageBucket,
      communityId,
      `${category}/${timestamp}-${random}.${ext}`
    );

    const contentType = getContentType(`file.${ext}`);

    // Fetch the image URI as ArrayBuffer (correct React Native pattern)
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (error) {
      console.error('[upload] Failed to upload image:', error.message);
      return null;
    }

    return path;
  } catch (err) {
    console.error('[upload] Unexpected error:', err);
    return null;
  }
}
