import { SwimTime }      from './swimtime';

export class Swimmer {
  regno :string = "";
  first_name :string = "";
  last_name :string = "";
  times :Array<SwimTime> = new Array();
  club :string = "";
  dob :string = ""; // YYYY-MM-dd
  gender :string = "";

  constructor(swimmerData :any) {
    Object.assign(this, swimmerData);
  }
}
