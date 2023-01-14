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
  const { user } = req.headers;
  const message = req.body;

  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.any().valid("message", "private_message").required(),
  });

  const messageValidation = messageSchema.validate(message, {
    abortEarly: false,
  });

  if (messageValidation.error) {
    const errors = messageValidation.error.details.map(
      (detail) => detail.message
    );
    return res.status(422).send(errors);
  }

  try {
    const userExists = await db
      .collection("participants")
      .findOne({ name: user });

    if (!userExists)
      return res.status(422).send("Mensagem inválida, o usuário não existe!");

    await db.collection("messages").insertOne({
      from: user,
      to: message.to,
      text: message.text,
      type: message.type,
      time: dayjs().format("h:m:s"),
    });

    res.status(201).send("Mensagem enviada!");
  } catch (err) {
    console.log(err);
    res.status(500).send("Um erro inesperado aconteceu no servidor!");
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const userExists = await db
      .collection("participants")
      .findOne({ name: user });

    if (!userExists)
      return res.status(404).send("O usuário informado não existe!");

    const result = await db.collection("participants").updateOne(
      { _id: ObjectId(userExists._id) },
      {
        $set: { lastStatus: Date.now() },
      }
    );

    if (result.modifiedCount === 0)
      return res.status(404).send("Um erro inesperado aconteceu!");

    res.status(200).send("Status atualizado!");
  } catch (err) {
    console.log(err);
    res.status(500).send("Um erro inesperado aconteceu no servidor!");
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (err) {
    console.log(err);
    res.status(500).send("Um erro inesperado aconteceu no servidor!");
  }
});

app.get("/messages", async (req, res) => {
  try {
  } catch (err) {}
});

app.listen(5000, () => {
  console.log("Server is listening on port 5000");
});
