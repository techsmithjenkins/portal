const fs = require('fs');
const csv = require('csv-parser');
const admin = require('firebase-admin');

// Path to your Firebase service account JSON
const serviceAccount = require('C:/Users/juris/Downloads/serviceAccountKey.json');


// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://class-portal-5015d-default-rtdb.firebaseio.com/' // Replace with your DB URL
});

const db = admin.database();

// CSV file path
// Replace with your CSV file 
const csvFilePath = "C:/Users/juris/Downloads/Class portal list.csv";


const results = [];

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    try {
      // Upload each row to Firebase
      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        await db.ref('students').push(row);
      }
      console.log('CSV data successfully uploaded to Firebase!');
      process.exit(0);
    } catch (error) {
      console.error('Error uploading to Firebase:', error);
      process.exit(1);
    }
  });
