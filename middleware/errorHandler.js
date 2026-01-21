export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: 'Invalid ID format'
        });
    }

    if (err.code === 11000) {
        return res.status(400).json({
            success: false,
            error: 'Duplicate entry'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
};

