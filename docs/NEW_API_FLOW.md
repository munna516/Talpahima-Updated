# New API Flow Guide - Cartoon Avatar Backend

## Complete API Endpoints

| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| POST | `/api/upload` | Upload image & generate cartoon | Original + Cartoon URLs |
| POST | `/api/regenerate/:originalId` | Regenerate cartoon | Cartoon URL |
| POST | `/api/download/:cartoonId` | Download & process face-cut | Face-cut URL |
| GET | `/api/originals` | Get all original images | Array of originals |
| GET | `/api/downloaded-faces` | Get all downloaded face-cuts | Array of faces |
| GET | `/uploads/:type/:filename` | Serve image files | Image file |

---

## 1. Upload Image & Generate Cartoon

### Flutter Request
```dart
POST http://your-node-server/api/upload
Headers: {
  "x-device-id": "123e4567-e89b-12d3-a456-426614174000",
  "Content-Type": "multipart/form-data"
}
Body: FormData with image file (key: "image")
```

### Node Backend Process
1. Validates `device_id` (UUID format)
2. Creates/updates Device record
3. **Saves original image file** to `/uploads/originals/{timestamp}_{deviceId}.jpg`
4. **Sends image file** to Python AI Server: `POST http://ai-server/generate-cartoon`
5. Python AI Server responds with **image file** (multipart/form-data)
6. **Saves cartoon image file** to `/uploads/temp/{timestamp}_{originalId}.jpg`
7. Creates `Original` document (permanent)
8. Creates `RegeneratedCartoon` document (temporary)

### Node Response
```json
{
  "success": true,
  "data": {
    "original": {
      "id": "507f1f77bcf86cd799439011",
      "imageUrl": "http://server/uploads/originals/1736123456789_abc123.jpg",
      "createdAt": "2024-01-05T20:33:55.000Z"
    },
    "cartoon": {
      "id": "507f1f77bcf86cd799439012",
      "imageUrl": "http://server/uploads/temp/1736123456790_507f1f77bcf86cd799439011.jpg",
      "createdAt": "2024-01-05T20:33:56.000Z"
    }
  }
}
```

### Flutter Action
Display `cartoon.imageUrl` to user

---

## 2. Regenerate Cartoon

### Flutter Request
```dart
POST http://your-node-server/api/regenerate/507f1f77bcf86cd799439011
Headers: {
  "x-device-id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Node Backend Process
1. Validates `device_id`
2. Finds Original by `originalId` and `deviceId`
3. **Reads original image file** from `/uploads/originals/...`
4. **Sends image file** to Python AI Server: `POST http://ai-server/generate-cartoon`
5. Python AI Server responds with **new cartoon image file**
6. **Saves new cartoon image file** to `/uploads/temp/{timestamp}_{originalId}.jpg`
7. Creates new `RegeneratedCartoon` document (temporary)

### Node Response
```json
{
  "success": true,
  "data": {
    "cartoon": {
      "id": "507f1f77bcf86cd799439013",
      "imageUrl": "http://server/uploads/temp/1736123456791_507f1f77bcf86cd799439011.jpg",
      "createdAt": "2024-01-05T20:35:12.000Z"
    }
  }
}
```

### Flutter Action
Add new cartoon to list, show to user

---

## 3. Download Selected Cartoon (Face-Cut Processing)

### Flutter Request
```dart
POST http://your-node-server/api/download/507f1f77bcf86cd799439013
Headers: {
  "x-device-id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Node Backend Process
1. Validates `device_id`
2. Finds `RegeneratedCartoon` by `cartoonId` and `deviceId`
3. Gets cartoon image URL: `http://server/uploads/temp/...`
4. **Sends image URL** to Python AI Server: `POST http://ai-server/process-face-cut`
   ```json
   {
     "image_url": "http://server/uploads/temp/1736123456791_507f1f77bcf86cd799439011.jpg"
   }
   ```
5. Python AI Server:
   - Downloads image from URL
   - Cuts face from image
   - Returns **face-cut image file**
6. **Saves face-cut image file** to `/uploads/downloaded/{timestamp}_{originalId}.jpg`
7. Creates `DownloadedFace` document (permanent)
8. **Deletes ALL `RegeneratedCartoon` documents** for this `originalId`
9. **Deletes ALL temporary files** from `/uploads/temp/` for this `originalId`

### Node Response
```json
{
  "success": true,
  "data": {
    "downloadedFace": {
      "id": "507f1f77bcf86cd799439014",
      "faceUrl": "http://server/uploads/downloaded/1736123456800_507f1f77bcf86cd799439011.jpg",
      "originalId": "507f1f77bcf86cd799439011",
      "createdAt": "2024-01-05T21:20:10.000Z"
    }
  }
}
```

### Flutter Action
Show success message, user can download face-cut image

---

## 4. Get All Original Images

### Flutter Request
```dart
GET http://your-node-server/api/originals
Headers: {
  "x-device-id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Node Backend Process
1. Validates `device_id`
2. Finds all `Original` documents for `deviceId`
3. Sorts by `createdAt` descending (most recent first)

### Node Response
```json
{
  "success": true,
  "data": {
    "originals": [
      {
        "id": "507f1f77bcf86cd799439011",
        "imageUrl": "http://server/uploads/originals/1736123456789_abc123.jpg",
        "fileSize": 2456789,
        "createdAt": "2024-01-05T20:33:55.000Z"
      },
      {
        "id": "507f1f77bcf86cd799439015",
        "imageUrl": "http://server/uploads/originals/1736123456900_def456.jpg",
        "fileSize": 1892345,
        "createdAt": "2024-01-05T19:20:10.000Z"
      }
    ],
    "count": 2
  }
}
```

### Flutter Action
Display grid/list of original images

---

## 5. Get All Downloaded Face-Cut Images

### Flutter Request
```dart
GET http://your-node-server/api/downloaded-faces
Headers: {
  "x-device-id": "123e4567-e89b-12d3-a456-426614174000"
}
Query Params (optional): ?page=1&limit=50
```

### Node Backend Process
1. Validates `device_id`
2. Finds all `DownloadedFace` documents for `deviceId`
3. Populates `originalId` to get original image info
4. Sorts by `createdAt` descending (most recent first)
5. Supports pagination

### Node Response
```json
{
  "success": true,
  "data": {
    "downloadedFaces": [
      {
        "id": "507f1f77bcf86cd799439014",
        "faceUrl": "http://server/uploads/downloaded/1736123456800_507f1f77bcf86cd799439011.jpg",
        "fileSize": 567890,
        "original": {
          "id": "507f1f77bcf86cd799439011",
          "imageUrl": "http://server/uploads/originals/1736123456789_abc123.jpg",
          "createdAt": "2024-01-05T20:33:55.000Z"
        },
        "createdAt": "2024-01-05T21:20:10.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "pages": 1
    }
  }
}
```

### Flutter Action
Display grid/list of downloaded face-cut images with original image reference

---

## 6. Serve Image Files (Static File Serving)

### Request
```
GET http://server/uploads/originals/1736123456789_abc123.jpg
GET http://server/uploads/temp/1736123456790_507f1f77bcf86cd799439011.jpg
GET http://server/uploads/downloaded/1736123456800_507f1f77bcf86cd799439011.jpg
```

### Response
- Content-Type: `image/jpeg` (or appropriate MIME type)
- Body: Image file binary data
- Status: 200 OK (or 404 if not found)

---

## Python Server API Contract

### 1. Generate Cartoon
**Endpoint:** `POST /generate-cartoon`
**Request:**
- Content-Type: `multipart/form-data`
- Body: FormData with `image` file

**Response:**
- Content-Type: `multipart/form-data` or `image/jpeg`
- Body: Generated cartoon image file (binary)

**Example:**
```javascript
// Node sends
const formData = new FormData();
formData.append('image', fileBuffer, {
  filename: 'original.jpg',
  contentType: 'image/jpeg'
});

// Python responds with image file buffer
const cartoonImageBuffer = response.data; // Binary image data
```

---

### 2. Process Face-Cut
**Endpoint:** `POST /process-face-cut`
**Request:**
```json
{
  "image_url": "http://node-server/uploads/temp/1736123456791_507f1f77bcf86cd799439011.jpg"
}
```

**Response:**
- Content-Type: `multipart/form-data` or `image/jpeg`
- Body: Processed face-cut image file (binary)

**Example:**
```javascript
// Node sends
const response = await axios.post('http://ai-server/process-face-cut', {
  image_url: 'http://server/uploads/temp/...'
}, {
  headers: { 'Content-Type': 'application/json' }
});

// Python responds with image file buffer
const faceCutBuffer = response.data; // Binary image data
```

---

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common Errors:

**400 Bad Request:**
- Invalid `device_id` format
- Missing image file
- Invalid `originalId` or `cartoonId` format
- File size exceeds limit (10MB)

**404 Not Found:**
- Original not found
- Cartoon not found
- Image file not found on disk

**500 Internal Server Error:**
- Python AI server error
- Database error
- File system error (disk full, permission denied)

---

## File Storage Details

### File Naming:
- Format: `{timestamp}_{identifier}.jpg`
- Timestamp: Unix timestamp in milliseconds (`Date.now()`)
- Identifier: 
  - Originals: `deviceId` (first 8 chars)
  - Temp/Downloaded: `originalId` (ObjectId string)

### Example Filenames:
```
1736123456789_abc12345.jpg          # Original
1736123456790_507f1f77bcf86cd799439011.jpg  # Temp cartoon
1736123456800_507f1f77bcf86cd799439011.jpg  # Downloaded face
```

### File Paths:
- Originals: `/uploads/originals/{filename}`
- Temporary: `/uploads/temp/{filename}`
- Downloaded: `/uploads/downloaded/{filename}`

---

## Security Considerations

1. **File Access Control:**
   - Only serve files for authenticated `deviceId`
   - Validate file paths to prevent directory traversal
   - Check file exists before serving

2. **File Upload Validation:**
   - Only image files allowed
   - File size limit: 10MB
   - MIME type validation

3. **Path Traversal Prevention:**
   - Sanitize filenames
   - Validate file paths
   - Use absolute paths from project root

---

## Performance Tips

1. **File Serving:**
   - Use Express `static` middleware for efficient serving
   - Set proper cache headers
   - Consider CDN for production

2. **File Operations:**
   - Use async file operations (`fs.promises`)
   - Stream large files instead of loading into memory
   - Clean up temporary files promptly

3. **Database:**
   - Index `deviceId` and `originalId` fields
   - Use pagination for list endpoints
   - Populate references efficiently
