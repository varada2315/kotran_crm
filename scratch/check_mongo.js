import { MongoClient } from 'mongodb';

const mongoUri = "mongodb://growitatewebsitere_user:growitatewebsitere_usern4nikhilkana@localhost:27017/growitatewebsitere?authSource=growitatewebsitere";

async function check() {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('dev_store');
    const doc = await collection.findOne({ _id: 'singleton' });
    if (!doc) {
      console.log("No singleton document found in dev_store collection.");
      return;
    }
    console.log("Total Clients:", doc.clients.length);
    console.log("Latest 5 Clients:");
    const latest = doc.clients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
    console.log(JSON.stringify(latest, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

check();
