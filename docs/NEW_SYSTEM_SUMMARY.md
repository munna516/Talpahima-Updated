# New System Summary - Cartoon Avatar Backend

## Quick Overview

This system allows users to upload images, generate cartoon versions, regenerate multiple times, and download face-cut processed images.

**Key Changes from Old System:**
- ✅ Node.js stores image files (not just URLs)
- ✅ Python Server sends image files (not URLs)
- ✅ Temporary regenerated images deleted when user downloads
- ✅ Only original and downloaded face-cut images stored permanently
- ✅ Two new APIs: Get all originals, Get all downloaded faces

---

## Architecture Summary

```
Flutter App
    ↓ (device_id + image file)
Node Backend
    ├──→ Stores original image (permanent)
    ├──→ Sends image file to Python
    ├──→ Receives cartoon image file
    ├──→ Stores cartoon image (temporary)
    └──→ Returns image URLs to Flutter

On Download:
    ├──→ Sends cartoon URL to Python
    ├──→ Receives face-cut image file
    ├──→ Stores face-cut image (permanent)
    └──→ Deletes all temporary regenerated images
```

---

## Database Collections

### 1. **devices**
- Tracks device activity
- Fields: `deviceId`, `createdAt`, `lastActiveAt`

### 2. **originals**
- **Permanent** original image metadata
- Fields: `deviceId`, `filename`, `filePath`, `imageUrl`, `fileSize`, `mimeType`, `createdAt`

### 3. **regenerated_cartoons**
- **Temporary** regenerated cartoon metadata
- Fields: `deviceId`, `originalId`, `filename`, `filePath`, `imageUrl`, `fileSize`, `mimeType`, `createdAt`
- **Deleted when user downloads**

### 4. **downloaded_faces**
- **Permanent** face-cut image metadata
- Fields: `deviceId`, `originalId`, `filename`, `filePath`, `faceUrl`, `fileSize`, `mimeType`, `sourceCartoonId`, `createdAt`

---

## File Storage Structure

```
uploads/
├── originals/          # Permanent
│   └── {timestamp}_{deviceId}.jpg
├── temp/              # Temporary (deleted on download)
│   └── {timestamp}_{originalId}.jpg
└── downloaded/        # Permanent
    └── {timestamp}_{originalId}.jpg
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/upload` | Upload image & generate cartoon |
| POST | `/api/regenerate/:originalId` | Regenerate cartoon |
| POST | `/api/download/:cartoonId` | Download & process face-cut |
| GET | `/api/originals` | Get all original images |
| GET | `/api/downloaded-faces` | Get all downloaded face-cuts |
| GET | `/uploads/:type/:filename` | Serve image files |

---

## Complete Flow Example

### Step 1: Upload
```
User uploads image.jpg
→ Node stores: /uploads/originals/1736123456789_abc123.jpg (permanent)
→ Python generates cartoon
→ Node stores: /uploads/temp/1736123456790_orig1.jpg (temporary)
→ Flutter shows cartoon URL
```

### Step 2: Regenerate (3 times)
```
Regenerate 1: /uploads/temp/1736123456791_orig1.jpg (temporary)
Regenerate 2: /uploads/temp/1736123456792_orig1.jpg (temporary)
Regenerate 3: /uploads/temp/1736123456793_orig1.jpg (temporary)
→ Flutter shows 4 cartoons (original + 3 regenerated)
```

### Step 3: Download Selected
```
User selects cartoon 3 and downloads
→ Python processes face-cut
→ Node stores: /uploads/downloaded/1736123456800_orig1.jpg (permanent)
→ Node deletes: All 4 temporary files
→ Flutter shows face-cut URL
```

### Result:
- ✅ Original: Still exists (permanent)
- ✅ Face-cut: Created (permanent)
- ✅ Temporary cartoons: All deleted

---

## Python Server API

### 1. Generate Cartoon
**POST** `/generate-cartoon`
- **Input:** Image file (multipart/form-data)
- **Output:** Cartoon image file (binary)

### 2. Process Face-Cut
**POST** `/process-face-cut`
- **Input:** `{ "image_url": "http://..." }`
- **Output:** Face-cut image file (binary)

---

## Key Features

### ✅ Permanent Storage
- Original images: Never deleted
- Downloaded face-cuts: Never deleted

### ✅ Temporary Storage
- Regenerated cartoons: Deleted when user downloads
- Automatic cleanup prevents disk space issues

### ✅ File Management
- Timestamp-based filenames prevent collisions
- Organized folder structure (originals/temp/downloaded)
- File serving via Express static middleware

### ✅ User Experience
- Users can regenerate unlimited times
- Only final choice is stored permanently
- Clean storage (no clutter from unused regenerations)

---

## Implementation Checklist

### Backend Changes Needed:

- [ ] Update `Original` model (add file fields)
- [ ] Create `RegeneratedCartoon` model
- [ ] Create `DownloadedFace` model
- [ ] Update `uploadController` (store files, send files to Python)
- [ ] Update `regenerateController` (store temp files)
- [ ] Create `downloadController` (face-cut processing, cleanup)
- [ ] Create `originalController` (get all originals)
- [ ] Create `downloadedFaceController` (get all faces)
- [ ] Add file serving middleware
- [ ] Add file cleanup logic
- [ ] Update routes

### File System Setup:

- [ ] Create `uploads/originals/` folder
- [ ] Create `uploads/temp/` folder
- [ ] Create `uploads/downloaded/` folder
- [ ] Add to `.gitignore`
- [ ] Set proper permissions

### Python Server Changes:

- [ ] Update to send image files (not URLs)
- [ ] Add `/process-face-cut` endpoint
- [ ] Implement face-cutting logic

---

## Error Scenarios

### File Not Found
- User requests deleted temporary image → 404
- Solution: Check file exists before serving

### Disk Full
- Cannot save new file → 507 Insufficient Storage
- Solution: Monitor disk space, cleanup old temp files

### Python Server Error
- AI generation fails → 500
- Solution: Return error message, don't create DB record

### Invalid File
- Non-image file uploaded → 400
- Solution: Validate MIME type before saving

---

## Security Checklist

- [ ] Validate `deviceId` on all endpoints
- [ ] Sanitize filenames (prevent path traversal)
- [ ] Validate file paths (must be in uploads folder)
- [ ] Check file ownership (deviceId matches)
- [ ] Limit file size (10MB max)
- [ ] Validate MIME types (images only)
- [ ] Set proper file permissions (read-only for served files)

---

## Performance Considerations

1. **File Serving:** Use Express static middleware
2. **File Operations:** Use async `fs.promises`
3. **Cleanup:** Delete temp files immediately after download
4. **Database:** Index `deviceId` and `originalId`
5. **Pagination:** Support pagination on list endpoints

---

## Future Enhancements

1. **Image Compression:** Compress stored images
2. **CDN Integration:** Move files to cloud storage
3. **Thumbnail Generation:** Generate thumbnails for faster loading
4. **Cleanup Cron Job:** Remove temp files older than 24h
5. **Image Metadata:** Store dimensions, file size, etc.

---

## Documentation Files

- **NEW_ARCHITECTURE.md** - Complete system architecture
- **NEW_DATABASE_DESIGN.md** - Database schema and relationships
- **NEW_API_FLOW.md** - Detailed API flow and examples
- **NEW_SYSTEM_SUMMARY.md** - This summary document

---

## Questions?

If you need clarification on any part of the design, please refer to the detailed documentation files or ask for specific implementation guidance.
