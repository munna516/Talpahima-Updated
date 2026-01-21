# New Database Design - Cartoon Avatar Backend

## Database Collections

### 1. **devices** Collection
**Purpose**: Track device activity (unchanged)

```javascript
{
  _id: ObjectId("..."),
  deviceId: "123e4567-e89b-12d3-a456-426614174000",  // UUID
  createdAt: ISODate("2024-01-05T20:33:55.000Z"),
  lastActiveAt: ISODate("2024-01-05T21:20:10.000Z")
}
```

**Indexes:**
- `deviceId` (unique)

---

### 2. **originals** Collection
**Purpose**: Store permanent original image metadata

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  deviceId: "123e4567-e89b-12d3-a456-426614174000",
  filename: "1736123456789_abc123.jpg",  // Timestamp-based filename
  filePath: "/uploads/originals/1736123456789_abc123.jpg",  // Relative path
  imageUrl: "http://server/uploads/originals/1736123456789_abc123.jpg",  // Full URL
  fileSize: 2456789,  // Bytes
  mimeType: "image/jpeg",
  createdAt: ISODate("2024-01-05T20:33:55.000Z")
}
```

**Fields:**
- `deviceId`: UUID of device/user
- `filename`: Timestamp-based filename
- `filePath`: Relative path from project root
- `imageUrl`: Full URL for serving
- `fileSize`: File size in bytes
- `mimeType`: Image MIME type
- `createdAt`: Upload timestamp

**Indexes:**
- `deviceId` - Fast queries for user's originals
- `createdAt` - Sort by recent first
- `filename` (unique) - Prevent duplicates

**Business Logic:**
- Created on first upload
- Permanent storage (never deleted)
- One per upload

---

### 3. **regenerated_cartoons** Collection
**Purpose**: Store temporary regenerated cartoon metadata

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439012"),
  deviceId: "123e4567-e89b-12d3-a456-426614174000",
  originalId: ObjectId("507f1f77bcf86cd799439011"),  // Reference to Original
  filename: "1736123456791_507f1f77bcf86cd799439011.jpg",
  filePath: "/uploads/temp/1736123456791_507f1f77bcf86cd799439011.jpg",
  imageUrl: "http://server/uploads/temp/1736123456791_507f1f77bcf86cd799439011.jpg",
  fileSize: 1892345,
  mimeType: "image/jpeg",
  createdAt: ISODate("2024-01-05T20:35:12.000Z")
}
```

**Fields:**
- `deviceId`: UUID of device/user
- `originalId`: Reference to Original document
- `filename`: Timestamp-based filename
- `filePath`: Relative path from project root
- `imageUrl`: Full URL for serving
- `fileSize`: File size in bytes
- `mimeType`: Image MIME type
- `createdAt`: Generation timestamp

**Indexes:**
- `deviceId` - Fast queries for user's cartoons
- `originalId` - Fast queries for cartoons of an original
- `createdAt` - Sort by recent first
- Compound: `{originalId: 1, createdAt: -1}` - Get all temp cartoons for an original

**Business Logic:**
- Created on each regeneration
- **Temporary storage** - deleted when user downloads
- Multiple per original allowed
- Files deleted from disk when document deleted

---

### 4. **downloaded_faces** Collection
**Purpose**: Store permanent downloaded face-cut image metadata

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439013"),
  deviceId: "123e4567-e89b-12d3-a456-426614174000",
  originalId: ObjectId("507f1f77bcf86cd799439011"),  // Reference to Original
  filename: "1736123456800_507f1f77bcf86cd799439011.jpg",
  filePath: "/uploads/downloaded/1736123456800_507f1f77bcf86cd799439011.jpg",
  faceUrl: "http://server/uploads/downloaded/1736123456800_507f1f77bcf86cd799439011.jpg",
  fileSize: 567890,
  mimeType: "image/jpeg",
  sourceCartoonId: ObjectId("507f1f77bcf86cd799439012"),  // Which cartoon was selected
  createdAt: ISODate("2024-01-05T21:20:10.000Z")
}
```

**Fields:**
- `deviceId`: UUID of device/user
- `originalId`: Reference to Original document
- `filename`: Timestamp-based filename
- `filePath`: Relative path from project root
- `faceUrl`: Full URL for serving face-cut image
- `fileSize`: File size in bytes
- `mimeType`: Image MIME type
- `sourceCartoonId`: Reference to RegeneratedCartoon that was selected (for history)
- `createdAt`: Download timestamp

**Indexes:**
- `deviceId` - Fast queries for user's downloads
- `originalId` - Fast queries for downloads of an original
- `createdAt` - Sort by recent first
- Compound: `{deviceId: 1, createdAt: -1}` - Efficient pagination

**Business Logic:**
- Created when user downloads/selects a cartoon
- **Permanent storage** - never deleted
- One per original (user can only download once per original)
- Links back to original image

---

## Relationships

```
devices (1) ──→ (many) originals
originals (1) ──→ (many) regenerated_cartoons (temporary)
originals (1) ──→ (1) downloaded_faces (permanent)
regenerated_cartoons (1) ──→ (1) downloaded_faces (source)
```

---

## Data Flow Examples

### Example 1: Upload & First Generation

**Upload:**
```javascript
// Original created
{
  _id: ObjectId("orig1"),
  deviceId: "device123",
  filename: "1736123456789_device123.jpg",
  filePath: "/uploads/originals/1736123456789_device123.jpg",
  imageUrl: "http://server/uploads/originals/1736123456789_device123.jpg",
  createdAt: "2024-01-05T20:33:55.000Z"
}

// First cartoon created (temporary)
{
  _id: ObjectId("cartoon1"),
  deviceId: "device123",
  originalId: ObjectId("orig1"),
  filename: "1736123456790_orig1.jpg",
  filePath: "/uploads/temp/1736123456790_orig1.jpg",
  imageUrl: "http://server/uploads/temp/1736123456790_orig1.jpg",
  createdAt: "2024-01-05T20:33:56.000Z"
}
```

---

### Example 2: Regenerate Multiple Times

**Regenerate 1:**
```javascript
{
  _id: ObjectId("cartoon2"),
  originalId: ObjectId("orig1"),
  filename: "1736123456791_orig1.jpg",
  filePath: "/uploads/temp/1736123456791_orig1.jpg",
  createdAt: "2024-01-05T20:35:12.000Z"
}
```

**Regenerate 2:**
```javascript
{
  _id: ObjectId("cartoon3"),
  originalId: ObjectId("orig1"),
  filename: "1736123456792_orig1.jpg",
  filePath: "/uploads/temp/1736123456792_orig1.jpg",
  createdAt: "2024-01-05T20:36:45.000Z"
}
```

**Regenerate 3:**
```javascript
{
  _id: ObjectId("cartoon4"),
  originalId: ObjectId("orig1"),
  filename: "1736123456793_orig1.jpg",
  filePath: "/uploads/temp/1736123456793_orig1.jpg",
  createdAt: "2024-01-05T20:38:20.000Z"
}
```

**Result:** 4 temporary cartoons (cartoon1, cartoon2, cartoon3, cartoon4)

---

### Example 3: Download Selected Cartoon

**User selects cartoon3 and downloads:**

**Created:**
```javascript
// DownloadedFace created
{
  _id: ObjectId("face1"),
  deviceId: "device123",
  originalId: ObjectId("orig1"),
  filename: "1736123456800_orig1.jpg",
  filePath: "/uploads/downloaded/1736123456800_orig1.jpg",
  faceUrl: "http://server/uploads/downloaded/1736123456800_orig1.jpg",
  sourceCartoonId: ObjectId("cartoon3"),
  createdAt: "2024-01-05T21:20:10.000Z"
}
```

**Deleted:**
- All `RegeneratedCartoon` documents for `originalId: orig1`
- All temporary files: `cartoon1.jpg`, `cartoon2.jpg`, `cartoon3.jpg`, `cartoon4.jpg`

**Result:**
- Original: Still exists (permanent)
- Temporary cartoons: All deleted
- Downloaded face: Created (permanent)

---

## Query Patterns

### Get All Originals for Device
```javascript
Original.find({ deviceId: "device123" })
  .sort({ createdAt: -1 })
```

### Get All Temporary Cartoons for Original
```javascript
RegeneratedCartoon.find({ originalId: ObjectId("orig1") })
  .sort({ createdAt: -1 })
```

### Get Downloaded Face for Original
```javascript
DownloadedFace.findOne({ originalId: ObjectId("orig1") })
```

### Get All Downloaded Faces for Device
```javascript
DownloadedFace.find({ deviceId: "device123" })
  .populate('originalId', 'imageUrl createdAt')
  .sort({ createdAt: -1 })
```

---

## Migration Notes

### Changes from Old Schema:

1. **Removed:**
   - `Cartoon` collection (replaced by `RegeneratedCartoon`)
   - `Download` collection (replaced by `DownloadedFace`)
   - `imageId` field (using ObjectId instead)
   - `cartoonId` field (using ObjectId instead)
   - `isSelected` flag (not needed)

2. **Added:**
   - `filename` field (timestamp-based)
   - `filePath` field (relative path)
   - `fileSize` field (bytes)
   - `mimeType` field
   - `sourceCartoonId` field (for history tracking)

3. **Changed:**
   - URLs now point to Node.js file server (not Python AI server)
   - File storage on Node.js server (not Python server)
   - Temporary vs permanent storage distinction

---

## Validation Rules

1. **Original:**
   - `deviceId`: Required, UUID format
   - `filename`: Required, unique
   - `filePath`: Required, must start with `/uploads/originals/`
   - `fileSize`: Required, > 0, < 10MB

2. **RegeneratedCartoon:**
   - `originalId`: Required, must reference existing Original
   - `filePath`: Required, must start with `/uploads/temp/`
   - `deviceId`: Must match Original's deviceId

3. **DownloadedFace:**
   - `originalId`: Required, must reference existing Original
   - `filePath`: Required, must start with `/uploads/downloaded/`
   - `deviceId`: Must match Original's deviceId
   - One per original (enforce uniqueness)

---

## Cleanup Strategy

### Automatic Cleanup:
- When user downloads: Delete all `RegeneratedCartoon` for that `originalId`
- Delete corresponding files from `/uploads/temp/`

### Manual Cleanup (Cron Job):
- Find `RegeneratedCartoon` documents older than 24 hours
- Delete documents and files
- Prevents disk space issues if user never downloads
