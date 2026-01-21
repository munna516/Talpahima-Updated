# New System Architecture - Cartoon Avatar Backend

## Overview

This document describes the updated architecture where:
- **Original images**: Stored permanently
- **Regenerated cartoons**: Stored temporarily, deleted when user downloads
- **Downloaded face-cut images**: Stored permanently
- **File storage**: VPS filesystem with timestamp-based filenames

---

## System Flow

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│ Flutter App │ ──────> │ Node Backend │ ──────> │ Python AI    │
│             │         │              │         │ Server       │
│             │ <────── │              │ <────── │              │
└─────────────┘         └──────────────┘         └──────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │   MongoDB    │
                        └──────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │ File System  │
                        │  (VPS Disk)  │
                        └──────────────┘
```

---

## Complete User Journey

### 1. **Upload Image & Generate Cartoon**

**Flow:**
```
Flutter → Node: device_id + image file
Node: Store original image file (permanent) → /uploads/originals/{timestamp}_{deviceId}.jpg
Node → Python: image file (multipart/form-data)
Python → Node: cartoon image file (multipart/form-data)
Node: Store cartoon image temporarily → /uploads/temp/{timestamp}_{originalId}.jpg
Node → Flutter: cartoon image URL
```

**Database:**
- Creates `Original` document with file path
- Creates `RegeneratedCartoon` document (temporary) with file path

**File Storage:**
- Original: `/uploads/originals/1736123456789_abc123.jpg` (permanent)
- Cartoon: `/uploads/temp/1736123456790_originalId.jpg` (temporary)

---

### 2. **Regenerate Cartoon** (Multiple Times)

**Flow:**
```
Flutter → Node: device_id + originalId
Node: Read original image file from disk
Node → Python: original image file
Python → Node: new cartoon image file
Node: Store cartoon image temporarily → /uploads/temp/{timestamp}_{originalId}.jpg
Node → Flutter: cartoon image URL
```

**Database:**
- Creates new `RegeneratedCartoon` document (temporary)
- Multiple regenerations = multiple temporary files

**File Storage:**
- Each regeneration: `/uploads/temp/{timestamp}_{originalId}.jpg` (temporary)

---

### 3. **Select & Download Cartoon** (Face-Cut Processing)

**Flow:**
```
Flutter → Node: device_id + cartoonId (selected one)
Node: Get cartoon image file path → convert to URL
Node → Python: cartoon image URL
Python: Download image, cut face, process
Python → Node: face-cut image file
Node: Store face-cut image permanently → /uploads/downloaded/{timestamp}_{originalId}.jpg
Node: Delete ALL temporary regenerated images for this originalId
Node → Flutter: face-cut image URL
```

**Database:**
- Creates `DownloadedFace` document (permanent)
- Deletes ALL `RegeneratedCartoon` documents for this originalId

**File Storage:**
- Face-cut: `/uploads/downloaded/{timestamp}_{originalId}.jpg` (permanent)
- Deletes: All `/uploads/temp/{timestamp}_{originalId}.jpg` files

---

### 4. **View All Original Images**

**Flow:**
```
Flutter → Node: device_id
Node: Query all Original documents for deviceId
Node → Flutter: Array of original images with URLs
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originals": [
      {
        "id": "...",
        "imageUrl": "http://server/uploads/originals/...",
        "createdAt": "..."
      }
    ]
  }
}
```

---

### 5. **View All Downloaded Face-Cut Images**

**Flow:**
```
Flutter → Node: device_id
Node: Query all DownloadedFace documents for deviceId
Node → Flutter: Array of face-cut images with URLs
```

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadedFaces": [
      {
        "id": "...",
        "faceUrl": "http://server/uploads/downloaded/...",
        "originalId": "...",
        "createdAt": "..."
      }
    ]
  }
}
```

---

## File Storage Structure

```
uploads/
├── originals/          # Permanent original images
│   ├── 1736123456789_abc123.jpg
│   ├── 1736123456790_def456.jpg
│   └── ...
├── temp/              # Temporary regenerated cartoons
│   ├── 1736123456791_originalId1.jpg
│   ├── 1736123456792_originalId1.jpg
│   ├── 1736123456793_originalId1.jpg
│   └── ...
└── downloaded/        # Permanent face-cut images
    ├── 1736123456800_originalId1.jpg
    ├── 1736123456801_originalId2.jpg
    └── ...
```

**File Naming Convention:**
- Format: `{timestamp}_{identifier}.jpg`
- Timestamp: Unix timestamp in milliseconds
- Identifier: `deviceId` for originals, `originalId` for temp/downloaded

---

## API Endpoints

| Method | Endpoint | Purpose | File Storage |
|--------|----------|----------|--------------|
| POST | `/api/upload` | Upload image & generate cartoon | Original: permanent<br>Cartoon: temporary |
| POST | `/api/regenerate/:originalId` | Regenerate cartoon | Cartoon: temporary |
| POST | `/api/download/:cartoonId` | Download & process face-cut | Face-cut: permanent<br>Deletes temp files |
| GET | `/api/originals` | Get all original images | Read from disk |
| GET | `/api/downloaded-faces` | Get all downloaded face-cuts | Read from disk |
| GET | `/api/temp/:cartoonId` | Serve temporary cartoon image | Read from disk |

---

## Key Design Decisions

### ✅ Why This Design?

1. **Temporary vs Permanent Storage**
   - Regenerated cartoons are temporary (user hasn't committed yet)
   - Original and downloaded images are permanent (user's assets)

2. **File Deletion on Download**
   - When user downloads, they've made a choice
   - All temporary regenerated images are deleted
   - Saves disk space

3. **Timestamp-Based Filenames**
   - Prevents filename collisions
   - Easy to identify file creation time
   - No need for complex ID generation

4. **Separate Collections**
   - `originals`: Permanent user uploads
   - `regenerated_cartoons`: Temporary generation attempts
   - `downloaded_faces`: Permanent processed results

5. **File Serving**
   - Node.js serves files directly from filesystem
   - URLs: `http://server/uploads/{type}/{filename}`
   - Static file serving middleware required

---

## Python Server API Contract

### 1. Generate Cartoon
**Endpoint:** `POST /generate-cartoon`
**Request:** Multipart form-data with `image` file
**Response:** 
- Content-Type: `multipart/form-data` or `image/jpeg`
- Body: Image file buffer

### 2. Process Face-Cut
**Endpoint:** `POST /process-face-cut`
**Request:** 
```json
{
  "image_url": "http://node-server/uploads/temp/..."
}
```
**Response:**
- Content-Type: `multipart/form-data` or `image/jpeg`
- Body: Processed face-cut image file buffer

---

## Error Handling

- **File Not Found**: Return 404 when serving images
- **Disk Full**: Return 507 (Insufficient Storage)
- **Python Server Error**: Return 500 with error message
- **Invalid File Format**: Return 400

---

## Security Considerations

1. **File Upload Validation**: Only image files allowed
2. **File Size Limits**: 10MB max per image
3. **Path Traversal Prevention**: Sanitize filenames
4. **Device Ownership**: All queries filter by `deviceId`
5. **File Access Control**: Only serve files for authenticated device

---

## Performance Optimizations

1. **File Serving**: Use Express static middleware for efficient file serving
2. **Async File Operations**: Use `fs.promises` for non-blocking I/O
3. **Image Compression**: Consider compressing stored images
4. **Cleanup Job**: Periodic cleanup of orphaned temporary files
5. **CDN Integration**: Future: Move files to CDN for faster serving

---

## Future Enhancements

1. **Image Compression**: Compress stored images to save space
2. **CDN Integration**: Move files to cloud storage (S3, etc.)
3. **Thumbnail Generation**: Generate thumbnails for faster loading
4. **Image Metadata**: Store image dimensions, file size, etc.
5. **Cleanup Cron Job**: Remove temporary files older than 24 hours
