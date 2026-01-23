# Cartoon Avatar Backend

Node.js Express backend server for Cartoon Avatar Flutter application. This server handles image uploads, cartoon generation, regeneration, face-cut processing, and file storage management.

## Architecture

- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Architecture**: MVC (Model-View-Controller)
- **Module System**: ES Modules (type: module)
- **File Storage**: Local filesystem (VPS-ready)

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (running locally or remote)
- Python AI Server (for cartoon generation and face-cut processing)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/cartoon-avatar
AI_SERVER_URL=http://localhost:8000
BASE_URL=http://localhost:3000
```

**Environment Variables:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `MONGODB_URI` - MongoDB connection string
- `AI_SERVER_URL` - Python AI Server URL
- `BASE_URL` - Base URL for file serving (for generating image URLs)

## Running the Project

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will start on the port specified in your `.env` file (default: 3000).

## API Endpoints

### 1. Upload Image & Generate Cartoon
**POST** `/api/upload`

Upload an image file and generate a cartoon version.

**Headers:**
- `x-device-id`: `{UUID}` (required)
- `Content-Type`: `multipart/form-data`

**Body:**
- `image`: Image file (JPEG, PNG, WebP) - Max 10MB

**Response:**
```json
{
  "success": true,
  "data": {
    "original": {
      "id": "507f1f77bcf86cd799439011",
      "imageUrl": "http://server/uploads/originals/1736123456789_abc123.jpg",
      "fileSize": 2456789,
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

---

### 2. Regenerate Cartoon
**POST** `/api/regenerate/:originalId`

Regenerate a cartoon for an existing original image. Returns the original image and all regenerated cartoons for that original.

**Headers:**
- `x-device-id`: `{UUID}` (required)

**URL Parameters:**
- `originalId`: Original image ObjectId (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "original": {
      "id": "507f1f77bcf86cd799439011",
      "imageUrl": "http://server/uploads/originals/1736123456789_abc123.jpg",
      "fileSize": 2456789,
      "createdAt": "2024-01-05T20:33:55.000Z"
    },
    "cartoons": [
      {
        "id": "507f1f77bcf86cd799439013",
        "imageUrl": "http://server/uploads/temp/1736123456791_507f1f77bcf86cd799439011.jpg",
        "fileSize": 1892345,
        "createdAt": "2024-01-05T20:35:12.000Z"
      },
      {
        "id": "507f1f77bcf86cd799439012",
        "imageUrl": "http://server/uploads/temp/1736123456790_507f1f77bcf86cd799439011.jpg",
        "fileSize": 1923456,
        "createdAt": "2024-01-05T20:33:56.000Z"
      }
    ],
    "count": 2
  }
}
```

**Note:** 
- The `cartoons` array includes all regenerated cartoons for the original image (sorted by most recent first)
- The newly generated cartoon will be the first item in the array
- All cartoons are temporary and will be deleted when the user downloads one

---

### 3. Download Cartoon (Face-Cut Processing)
**POST** `/api/download/:cartoonId`

Download and process a selected cartoon to create a face-cut image. This will delete all temporary regenerated cartoons for the same original.

**Headers:**
- `x-device-id`: `{UUID}` (required)

**URL Parameters:**
- `cartoonId`: Regenerated cartoon ObjectId (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadedFace": {
      "id": "507f1f77bcf86cd799439014",
      "faceUrl": "http://server/uploads/downloaded/1736123456800_507f1f77bcf86cd799439011.jpg",
      "originalId": "507f1f77bcf86cd799439011",
      "fileSize": 567890,
      "createdAt": "2024-01-05T21:20:10.000Z"
    }
  }
}
```

**Note:** After download, all temporary regenerated cartoons for this original are deleted.

---

### 4. Get All Original Images
**GET** `/api/originals`

Get all original images uploaded by the device.

**Headers:**
- `x-device-id`: `{UUID}` (required)

**Response:**
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
      }
    ],
    "count": 1
  }
}
```

---

### 5. Get All Downloaded Face-Cut Images
**GET** `/api/downloaded-faces`

Get all downloaded face-cut images with pagination support.

**Headers:**
- `x-device-id`: `{UUID}` (required)

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response:**
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

### 6. Root Route
**GET** `/`

Check if server is running.

**Response:**
```
Server is Running
```

---

### 7. Health Check
**GET** `/health`

Check server health status.

**Response:**
```
Online
```

---

## File Storage

Files are stored in the following structure:

```
uploads/
├── originals/          # Permanent original images
├── temp/              # Temporary regenerated cartoons (deleted on download)
└── downloaded/        # Permanent face-cut images
```

**File Naming:**
- Format: `{timestamp}_{identifier}.jpg`
- Timestamp: Unix timestamp in milliseconds
- Identifier: DeviceId (for originals) or OriginalId (for temp/downloaded)

**File Serving:**
- Files are served via Express static middleware
- URLs: `http://server/uploads/{type}/{filename}`

---

## Project Structure

```
├── config/
│   └── database.js              # MongoDB connection
├── controllers/
│   ├── deviceController.js      # Device management
│   ├── uploadController.js      # Image upload handling
│   ├── regenerateController.js  # Cartoon regeneration
│   ├── cartoonController.js     # Cartoon operations
│   ├── originalController.js    # Original image operations
│   ├── downloadController.js    # Download & face-cut processing
│   └── downloadedFaceController.js  # Downloaded faces operations
├── middleware/
│   ├── deviceValidator.js       # Device ID validation
│   └── errorHandler.js          # Error handling middleware
├── models/
│   ├── Device.js                # Device schema
│   ├── Original.js              # Original image schema
│   ├── RegeneratedCartoon.js   # Temporary cartoon schema
│   └── DownloadedFace.js       # Face-cut image schema
├── routes/
│   ├── uploadRoutes.js          # Upload routes
│   ├── regenerateRoutes.js      # Regenerate routes
│   ├── cartoonRoutes.js         # Cartoon routes
│   ├── originalRoutes.js       # Original routes
│   ├── downloadRoutes.js        # Download routes
│   └── downloadedFaceRoutes.js # Downloaded faces routes
├── utils/
│   └── fileStorage.js           # File storage utilities
├── uploads/                      # File storage directory
│   ├── originals/
│   ├── temp/
│   └── downloaded/
├── server.js                     # Main server file
├── package.json
└── README.md
```

---

## Python AI Server API Contract

### 1. Generate Cartoon
**Endpoint:** `POST /generate-cartoon`

**Request:**
- Content-Type: `multipart/form-data`
- Body: FormData with `image` file

**Response:**
- Content-Type: `image/jpeg` (binary)
- Body: Generated cartoon image file buffer

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
- Content-Type: `image/jpeg` (binary)
- Body: Processed face-cut image file buffer

---

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common Status Codes:**
- `400` - Bad Request (invalid input, missing file, etc.)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error (server/DB errors)
- `507` - Insufficient Storage (disk full)

---

## Security Considerations

1. **Device ID Validation**: All endpoints require valid UUID format `x-device-id` header
2. **File Upload Validation**: Only image files (JPEG, PNG, WebP) allowed
3. **File Size Limit**: Maximum 10MB per image
4. **Path Traversal Prevention**: Filenames are sanitized
5. **Ownership Checks**: All queries filter by `deviceId`
6. **File Access Control**: Files are served via Express static middleware

---

## Notes

- All API requests require `x-device-id` header (UUID format)
- Image uploads are limited to 10MB
- Only image files are accepted for upload (JPEG, PNG, WebP)
- Temporary regenerated cartoons are automatically deleted when user downloads
- Original images and downloaded face-cuts are stored permanently
- The server communicates with a Python AI Server for cartoon generation and face-cut processing

---

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Configure `BASE_URL` with your production domain
3. Ensure MongoDB is accessible
4. Ensure Python AI Server is running and accessible
5. Set proper file permissions for `uploads/` directory
6. Consider using a process manager (PM2) for production
7. Set up reverse proxy (Nginx) for better performance
8. Configure SSL/TLS certificates

---

## License

ISC