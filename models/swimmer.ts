import { SwimTime }      from './swimtime';
import moment = require('moment');

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

  setName(name: string) {
    var namesArr = name.trim().split(" ");
    console.log(namesArr);
    if(namesArr.length == 2) {
      this.last_name = namesArr[1];
      this.first_name = namesArr[0];
    } else {
      this.last_name = name;
    }
  }

  getFullName() {
    return `${this.last_name.toUpperCase()}, ${this.first_name}`;
  }

  getAgeAt(date :string) :number {
    var swimmerDob = moment(this.dob, 'DD/MM/YYYY');
    console.log("Swimmer: " + swimmerDob.format('YYYY-MM-DD'));
    var ageAt = moment(date, 'YYYY-MM-DD');
    return ageAt.diff(swimmerDob, 'years');
  }
}
