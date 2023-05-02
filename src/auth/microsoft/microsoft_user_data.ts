import { UserData } from "../user_data.js";

export abstract class MicrosoftUserData extends UserData {
    declare refresh_token?: string;
}
