import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import joi from "joi";
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
  const user = req.body;

  const userSchema = joi.object({
    name: joi.string().required(),
  });

  const userValidation = userSchema.validate(user, { abortEarly: false });

  if (userValidation.error) {
    const errors = userValidation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const userExists = await db
      .collection("participants")
      .findOne({ name: user.name });

    if (userExists)
      return res.status(409).send("Esse usuário já está cadastrado!");

    await db
      .collection("participants")
      .insertOne({ name: user.name, lastStatus: Date.now() });
    await db.collection("messages").insertOne({
      from: user.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("h:m:s"),
    });

    res.status(201).send("Cadastro efetuado!");
  } catch (err) {
    console.log(err);
    res.status(500).send("Um erro inesperado aconteceu no servidor!");
  }
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
  console.log("Server is listening on port 5000");
});
