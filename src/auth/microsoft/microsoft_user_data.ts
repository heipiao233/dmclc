import { UserData } from "../user_data";

export abstract class MicrosoftUserData extends UserData {
    declare refresh_token?: string;
}
