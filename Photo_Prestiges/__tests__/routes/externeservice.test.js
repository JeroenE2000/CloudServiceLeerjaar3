const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function compareImages(targetImage, uploadImage) {
    const targetFormdata = new FormData();
    const uploadFormdata = new FormData();
    targetFormdata.append('image', fs.createReadStream(targetImage))
    uploadFormdata.append('image', fs.createReadStream(uploadImage))

    const api_key = "acc_9b966df7a565ab9";
    const api_secret = "4f0acdcdba6a54477a6ef4510d130046";
    const encoded = Buffer.from(api_key + ':' + api_secret, 'utf8').toString('base64')  // encode to base64

    const url = "https://api.imagga.com/v2/tags";

    const targetOptions = {
        headers: {
            'Authorization': 'Basic ' + encoded,
        },
        method: 'POST',
        url: url,
        data: targetFormdata,
    };
    const uploadOptions = {
        headers: {
            'Authorization': 'Basic ' + encoded,
        },
        method: 'POST',
        url: url,
        data: uploadFormdata,
    };
    let targetResponse;
    let uploadResponse;
    return (async () => {
        try {
            targetResponse = await axios(targetOptions);
            uploadResponse = await axios(uploadOptions);

            const targetTags = targetResponse.data.result.tags;
            const uploadTags = uploadResponse.data.result.tags;
            
            let score = 0;
            let totalPercentageDifference = 0;
            let numberOfMatchingTags = 0;
            let percentage = 0;

            await targetTags.forEach(targetTag => {
                const matchingUploadTag = uploadTags.find(uploadTag => uploadTag.tag.en === targetTag.tag.en)
                if (matchingUploadTag) {
                    const targetConfidence = targetTag.confidence;
                    const uploadConfidence = matchingUploadTag.confidence;
                    const percentageDifference = Math.abs(targetConfidence - uploadConfidence) / targetConfidence * 100;
                    totalPercentageDifference += percentageDifference;
                    numberOfMatchingTags++;
                }
            });

            if (numberOfMatchingTags > 0) {
                score = 100 - totalPercentageDifference / numberOfMatchingTags;
                percentage = Math.round(score * 100) / 100;
            } else {
                percentage = 0;
            }
              
            percentage = score.toFixed(2);
            return percentage;
        } catch (error) {
            console.log(error);
        }
    })();
}

describe('compareImages', () => {
  test('should return the percentage match between two images', async () => {
    // create mock data for the function's parameters
    const targetImage = 'uploads/psv.png';
    const uploadImage = 'targetupload/psv1.png';

    // create mock data for the expected response
    const expectedResponse = "100.00";

    // call the function and check the result
    const result = await compareImages(targetImage, uploadImage);
    expect(result).toBe(expectedResponse);
  });
});