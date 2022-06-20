module.exports = existValidation = (ISnotValid, errorStatus, errorCode) => {
    if (ISnotValid) {
        const error = new Error(errorStatus);
        error.statusCode = errorCode;
        throw error;
    }
};

// existValidation(imageUrl, 'No file picked.', 422);
