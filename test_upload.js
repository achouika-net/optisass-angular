
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testUpload() {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream('test_import.csv'));

        const response = await axios.post('http://localhost:3000/api/imports/upload', form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

testUpload();
