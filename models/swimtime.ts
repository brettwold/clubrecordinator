import { TimeUtils }      from '../providers/timeutils.service';
import moment = require('moment');

const timeUtils = new TimeUtils();

export class SwimTime {
  source: string = "";
  race_type: number = -1;
  date: string = "";
  unix: number = -1;
  time: number = -1;
  time_orig: string = "";
  conv: number = -1;
  fina_points: number = -1;
  round: string = "";
  meet_name: string = "";
  venue: string = "";
  license: string = "";
  level: number = -1;
  swimmer_regno: number = -1;
  more: boolean = false;

  constructor (data :any) {
    Object.assign(this, data);
  }

  public setFormattedTime(timeStr :string) {
    this.time_orig = timeStr;
    let tenths = timeUtils.getHundredthsFromString(timeStr);
    this.time = tenths;
  }

  public setDateAchievedFromManual(dateStr :string) {
    let mom = moment(dateStr, 'DD/MM/YYYY');
    this.unix = mom.unix();
    this.date = mom.format('YYYY-MM-DD');
  }

  public setDateAchieved(dateStr: string) {
    this.unix = moment(dateStr, 'YYYY-MM-DD').unix();
    this.date = dateStr;
  }

  public getDateFormatted(formatStr: string) {
     return moment(this.date, 'YYYY-MM-DD').format(formatStr);
  }

  public setData(swimTime :any) {
    Object.assign(this, swimTime);
  }
}
