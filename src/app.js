import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db();
} catch (err) {
  console.log("Server Error");
  console.log(err);
}

/*------ROUTES--------*/

app.post("/participants", async (req, res) => {
  try {
  } catch (err) {}
});

app.post("/messages", async (req, res) => {
  try {
  } catch (err) {}
});

app.post("/status", async (req, res) => {
  try {
  } catch (err) {}
});

app.get("/participants", async (req, res) => {
  try {
  } catch (err) {}
});

app.get("/messages", async (req, res) => {
  try {
  } catch (err) {}
});

app.listen(5000, () => {
  console.log("Server is litening on port 5000");
});
