import { Schema, model } from "mongoose"

export const UserModel = model(
  "users",
  new Schema(
    {
      _id: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      password: {
        type: String,
        required: true,
      },
      username: {
        type: String,
        required: true,
      },
      profilePicture: {
        type: String,
        required: true,
      },
      biography: {
        required: false,
        type: String,
        default: "This user has no biography",
      },
    } as const,
    { _id: false }
  )
)
