const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;

export interface PhotoSharingCapacityAssumptions {
  /** Photos uploaded per day. */
  uploadsPerDay: number;
  /** Derivative sizes/formats generated per uploaded photo. */
  derivativesPerPhoto: number;
  /** Average original photo size in bytes. */
  originalBytes: number;
  /** Average size of one derivative in bytes. */
  derivativeBytes: number;
  /** Image views per uploaded photo (read:write ratio). */
  viewsPerUpload: number;
  /** Fraction of image reads served from the CDN edge (0–1). */
  cdnHitRate: number;
}

export interface PhotoSharingCapacityResults {
  uploadsPerSec: number;
  dailyStorageTb: number;
  viewQps: number;
  originQps: number;
  cdnOffloadFactor: number;
}

/**
 * Pure, deterministic capacity model. The lesson: photo sharing is write-amplified in storage and
 * read-amplified in serving. Each of 100M daily uploads fans into an original plus ~5 derivatives
 * (~6 MB total), producing ~600 TB/day of new storage — so an object store and an async pipeline that
 * generates derivatives are mandatory. And with ~100 views per upload, serving runs at ~116k image
 * requests/sec, but a 98%-hit CDN offloads ~50×, so the origin object store sees only ~2.3k/s. The app
 * tier barely touches image bytes: it orchestrates an async pipeline and hands out CDN URLs.
 */
export function calculatePhotoSharingCapacity(
  a: PhotoSharingCapacityAssumptions,
): PhotoSharingCapacityResults {
  const uploadsPerSec = a.uploadsPerDay / SECONDS_PER_DAY;
  const bytesPerPhoto = a.originalBytes + a.derivativesPerPhoto * a.derivativeBytes;
  const dailyStorageTb = (a.uploadsPerDay * bytesPerPhoto) / BYTES_PER_TB;
  const viewQps = (a.uploadsPerDay * a.viewsPerUpload) / SECONDS_PER_DAY;
  const originQps = viewQps * (1 - a.cdnHitRate);
  const cdnOffloadFactor = 1 / (1 - a.cdnHitRate);

  return {
    uploadsPerSec,
    dailyStorageTb,
    viewQps,
    originQps,
    cdnOffloadFactor,
  };
}
