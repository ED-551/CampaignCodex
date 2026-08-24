const path = require('path')

/**
 * Where uploaded files live on disk.
 *
 * This has to be resolved in exactly one place. It was previously computed
 * independently in the upload route and in the static-file mount, and the two
 * disagreed: the route defaulted to the container path `/app/uploads` while
 * the mount fell back to a directory beside the source. On any install that
 * did not set UPLOAD_DIR — a bare-metal host, or a dev machine — uploads
 * failed outright with ENOENT, or landed somewhere nothing was serving from.
 *
 * Set UPLOAD_DIR in production (the container mounts a volume at /app/uploads).
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')

module.exports = { UPLOAD_DIR }
