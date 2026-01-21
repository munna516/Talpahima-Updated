import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root directory
const projectRoot = path.resolve(__dirname, '..');

// Upload directories
const UPLOAD_DIRS = {
    originals: path.join(projectRoot, 'uploads', 'originals'),
    temp: path.join(projectRoot, 'uploads', 'temp'),
    downloaded: path.join(projectRoot, 'uploads', 'downloaded')
};

/**
 * Ensure upload directories exist
 */
export async function ensureUploadDirs() {
    try {
        for (const dir of Object.values(UPLOAD_DIRS)) {
            await fs.mkdir(dir, { recursive: true });
        }
    } catch (error) {
        console.error('Error creating upload directories:', error);
        throw error;
    }
}

/**
 * Generate filename with timestamp
 * @param {string} identifier - deviceId or originalId string
 * @returns {string} filename
 */
export function generateFilename(identifier) {
    const timestamp = Date.now();
    // Use first 8 chars of identifier for readability
    const shortId = identifier.toString().substring(0, 8);
    return `${timestamp}_${shortId}.jpg`;
}

/**
 * Get file path for a given type and filename
 * @param {string} type - 'originals', 'temp', or 'downloaded'
 * @param {string} filename
 * @returns {string} absolute file path
 */
export function getFilePath(type, filename) {
    if (!UPLOAD_DIRS[type]) {
        throw new Error(`Invalid upload type: ${type}`);
    }
    return path.join(UPLOAD_DIRS[type], filename);
}

/**
 * Get relative path from project root
 * @param {string} type - 'originals', 'temp', or 'downloaded'
 * @param {string} filename
 * @returns {string} relative path
 */
export function getRelativePath(type, filename) {
    return `/uploads/${type}/${filename}`;
}

/**
 * Get full URL for serving files
 * @param {string} type - 'originals', 'temp', or 'downloaded'
 * @param {string} filename
 * @param {string} baseUrl - Server base URL
 * @returns {string} full URL
 */
export function getFileUrl(type, filename, baseUrl = '') {
    const relativePath = getRelativePath(type, filename);
    return `${baseUrl}${relativePath}`;
}

/**
 * Save file to disk
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} type - 'originals', 'temp', or 'downloaded'
 * @param {string} filename
 * @returns {Promise<string>} absolute file path
 */
export async function saveFile(fileBuffer, type, filename) {
    const filePath = getFilePath(type, filename);
    
    // Ensure directory exists
    await ensureUploadDirs();
    
    // Write file
    await fs.writeFile(filePath, fileBuffer);
    
    return filePath;
}

/**
 * Read file from disk
 * @param {string} type - 'originals', 'temp', or 'downloaded'
 * @param {string} filename
 * @returns {Promise<Buffer>} file buffer
 */
export async function readFile(type, filename) {
    const filePath = getFilePath(type, filename);
    return await fs.readFile(filePath);
}

/**
 * Delete file from disk
 * @param {string} type - 'originals', 'temp', or 'downloaded'
 * @param {string} filename
 * @returns {Promise<void>}
 */
export async function deleteFile(type, filename) {
    try {
        const filePath = getFilePath(type, filename);
        await fs.unlink(filePath);
    } catch (error) {
        // File might not exist, ignore error
        if (error.code !== 'ENOENT') {
            console.error(`Error deleting file ${filename}:`, error);
            throw error;
        }
    }
}

/**
 * Check if file exists
 * @param {string} type - 'originals', 'temp', or 'downloaded'
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
export async function fileExists(type, filename) {
    try {
        const filePath = getFilePath(type, filename);
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get file stats (size, etc.)
 * @param {string} type - 'originals', 'temp', or 'downloaded'
 * @param {string} filename
 * @returns {Promise<Object>} file stats
 */
export async function getFileStats(type, filename) {
    const filePath = getFilePath(type, filename);
    return await fs.stat(filePath);
}

/**
 * Delete all temporary files for a specific originalId
 * @param {string} originalId - Original ObjectId string
 * @returns {Promise<number>} number of files deleted
 */
export async function deleteTempFilesForOriginal(originalId) {
    try {
        const tempDir = UPLOAD_DIRS.temp;
        const files = await fs.readdir(tempDir);
        const originalIdStr = originalId.toString();
        let deletedCount = 0;

        for (const file of files) {
            // Check if filename contains the originalId
            if (file.includes(originalIdStr)) {
                try {
                    await fs.unlink(path.join(tempDir, file));
                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting temp file ${file}:`, error);
                }
            }
        }

        return deletedCount;
    } catch (error) {
        console.error('Error deleting temp files:', error);
        return 0;
    }
}

/**
 * Sanitize filename to prevent path traversal
 * @param {string} filename
 * @returns {string} sanitized filename
 */
export function sanitizeFilename(filename) {
    // Remove path separators and dangerous characters
    return filename.replace(/[\/\\\?\*\|"<>:]/g, '_');
}
