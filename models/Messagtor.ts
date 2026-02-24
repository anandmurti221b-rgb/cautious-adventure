import { Schema, model, models } from "mongoose";

const messageSchema = new Schema({
  Name: {
    type: String,
    required: true,
  },
  Message: {
    type: String,
    required: true,
  }
});

const Message = models.Message || model("Message", messageSchema, "Messages");

export default Message;