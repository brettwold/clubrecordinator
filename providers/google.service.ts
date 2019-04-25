import fs = require('fs');
import readline = require('readline');

import { google } from 'googleapis';
import { AsaService } from './asa.service';
import { DefaultSwimData }  from '../models/default.swimdata';
import { Swimmer } from '../models/swimmer';
import { SwimTime } from '../models/swimtime';
import { Observable } from 'rxjs';
import { TimeUtils } from './timeutils.service';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = './token.json';
const RESPONSES_SPREADSHEET = '1SLGdn2I07mtM8cesfShDrAE5Xpfj7DY9lBiQoRJWgUM';
const RECORD_SPREADSHEET = '1Y41OKtQlTSam1Ax_7axgJ-jR0bbTNss8zK-V9dTNWzE';
const CERT_SLIDE_ID = '1bvw5QhEU1bUaDES4782VypZRE4c9t1RIQ_lTp6nA0LU';

const TAB_FORM_RESPONSES = "'Form responses 1'";
const TAB_RECORDS = "'All Results'";

const RANGE_FORM_RESPONSES = TAB_FORM_RESPONSES + "!B2:K"; // Email, ASA, Name, Course, Distance, Stroke, Date Set, Time, ManualCheck, Processed
const RANGE_CLUB_RECORDS = TAB_RECORDS + "!A2:H"; // Gender, Age, Course, Distance, Stroke, Name, Date Set, Time Set
const RANGE_DOB = "'DOB'!A1:C" // ASA, DOB, Gender[Male:Female]

const MAX_PROCESS_NUM = 10;

const timeUtils = new TimeUtils();

export class GoogleService {

  private page: any;
  private skiprank: boolean = false;

  private swimData: any;
  private sheets: any;
  private drive: any;
  private slides: any;
  private oAuth2Client :any;
  private asaService: AsaService;
  static readonly STROKE_LOOKUP :any = {
    'Free': 'Freestyle',
    'Breast': 'Breaststroke',
    'Back': 'Backstroke',
    'Fly': 'Butterfly',
    'IM': 'Individual',
  };

  constructor (page: any, skiprank: boolean) {
    this.swimData = DefaultSwimData.DATA;
    this.page = page;
    this.asaService = new AsaService(page);
  }

  parseResponses() {
    let self = this;
    fs.readFile('./credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      // Authorize a client with credentials, then call the Google Sheets API.
      self.authorize(JSON.parse(content.toString()));
    });
  }

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   */
  authorize(credentials :any) {
    let self = this;
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    self.oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return self.getNewToken();
      self.oAuth2Client.setCredentials(JSON.parse(token.toString()));
      self.sheets = google.sheets({version: 'v4', auth: self.oAuth2Client});
      self.drive = google.drive({version: 'v3', auth: self.oAuth2Client});
      self.slides = google.slides({version: 'v1', auth: self.oAuth2Client});
      self.processFormResponses();
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   */
  getNewToken() {
    let self = this;
    const authUrl = self.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      self.oAuth2Client.getToken(code, (err :string, token :any) => {
        if (err) return console.error('Error while trying to retrieve access token', err);
        self.oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
        self.sheets = google.sheets({version: 'v4', auth: self.oAuth2Client});
        self.processFormResponses();
      });
    });
  }

  processFormResponses() {
    let self = this;
    this.sheets.spreadsheets.values.get({
      spreadsheetId: RESPONSES_SPREADSHEET,
      range: RANGE_FORM_RESPONSES,
    }, (err :string, res :any) => {
      if (err) return console.log('The API returned an error: ' + err);
      const rows = res.data.values;
      var processedCount = 0;
      if (rows.length) {
        rows.map((row :any, index: number) => {
          if(row[9] != "TRUE" && processedCount < MAX_PROCESS_NUM) {
            console.log(`${row}`);
            ++processedCount;
            if(row[8] == "Y") {
              // time has been manually confirmed
              console.log('Manually approved time found');
              self.manuallyApprovedResponse(row, index+2);
            } else {
              // we go to rankings
              if(!self.skiprank) {
                console.log('Checking rankings for time');
                self.checkForTimeOnRankings(row, index+2);
              }
            }
          }
        });
      } else {
        console.log('No data found.');
      }
    });
  }

  private checkForTimeOnRankings(row: Array<any>, currentRow: number) {
    this.asaService.getSwimmer(row[1]).subscribe(swimmer => {
      this.asaService.findTimeMatch(swimmer, row[3], row[4], GoogleService.STROKE_LOOKUP[row[5]], row[6], row[7]).subscribe((recordTime) => {
        if(recordTime && recordTime.time > 0) {
          console.log('Time match found');
          this.checkRecord(swimmer, recordTime, currentRow, row[0]);
        } else {
          var msg = `Sorry we couldn't find a record of your swim time on Rankings. Please check the details entered and try again.`;
          console.log(`Swimmer Time: ${JSON.stringify(recordTime)}`);
          this.markAsProcessed(currentRow, "True", msg);
          console.log(msg);
          this.sendNoMatchEmail(row, msg, row[0]);
        }
      }, (error) => {
        console.log(error);
      });
    });
  }

  private manuallyApprovedResponse(row: Array<any>, currentRow: number) {
    let race_type = this.asaService.getRaceType(row[3], row[4], GoogleService.STROKE_LOOKUP[row[5]]);
    let recordTime = new SwimTime({});
    let swimmer = new Swimmer({});
    recordTime.race_type = race_type.id;
    recordTime.setDateAchievedFromManual(row[6]);
    recordTime.setFormattedTime(row[7]);
    swimmer.regno = row[1];
    swimmer.setName(row[2]);
    swimmer.times.push(recordTime);
    this.checkRecord(swimmer, recordTime, currentRow, row[0]);
  }

  private markAsProcessed(currentRow: number, processed: string, message :string) {
    let self = this;
    var body = {
      values: [[processed, message]]
    }
    var range = `${TAB_FORM_RESPONSES}!K${currentRow}:L`;
    this.sheets.spreadsheets.values.update({
      spreadsheetId: RESPONSES_SPREADSHEET,
      range: range,
      valueInputOption: "USER_ENTERED",
      resource: body,
    }, (err :string, result :any) => {
      if (err) {
        console.log(err);
      } else {
        console.log('Responses sheet: Row %d cells updated.', currentRow);
      }
    });
  }

  private checkRecord(swimmer :Swimmer, swimtime :SwimTime, responseRow: number, responseEmail: string) {
    let self = this;
    this.updateDob(swimmer).subscribe(swimmer => {
      self.sheets.spreadsheets.values.get({
        spreadsheetId: RECORD_SPREADSHEET,
        range: RANGE_CLUB_RECORDS,
      }, (err :string, res :any) => {
        if (err) return console.log('The API returned an error while reading records: ' + err);
        const rows = res.data.values;
        if (rows.length) {
          var ageAtRecord = swimmer.getAgeAt(swimtime.date);
          console.log("Age at record time: " + ageAtRecord);
          rows.map((row :any, index: number) => {
            var recordRaceType = self.asaService.getRaceType(row[2], row[3], GoogleService.STROKE_LOOKUP[row[4]]);
            if(row[0] == swimmer.gender && row[1] == ageAtRecord && swimtime.race_type == recordRaceType.id) {
              console.log(`Found matching record ${row}`)
              var currentRecordTime = 9999999;
              var currentRecordOrig = row[7];
              if(currentRecordOrig) {
                currentRecordTime = timeUtils.getHundredthsFromString(currentRecordOrig);
              }
              if(currentRecordTime > swimtime.time) {
                var msg = `Well done ${swimmer.first_name} you got a new club record ${swimtime.time_orig} for the ${recordRaceType.distance}m ${this.swimData.strokes[recordRaceType.stroke]} ${recordRaceType.course_type} at age ${ageAtRecord}. The club records page will be updated soon. Congratulations!`;
                console.log(msg);
                self.updateRecord(swimmer, swimtime, recordRaceType, index+2);
                self.markAsProcessed(responseRow, "True", msg);
                self.generateCertificate(swimmer, swimtime, recordRaceType, ageAtRecord);
                self.sendMatchEmail(row, msg, responseEmail);
              } else {
                var msg = `Sorry, we processed your record claim but your time is not quick enough. Record: ${currentRecordOrig} - Claim time: ${swimtime.time_orig}`;
                console.log(msg);
                self.sendNoMatchEmail(row, msg, responseEmail);
                self.markAsProcessed(responseRow, "True", msg);
              }
            }
          });
        }
      });
    });
  }

  private generateCertificate(swimmer: Swimmer, swimtime: SwimTime, recordRaceType: any, ageAtRecord: number) {
    let self = this;
    let copyTitle = `${swimmer.last_name}-${swimtime.unix}-${recordRaceType.id}-certificate`;
    let name = `${swimmer.first_name} ${swimmer.last_name}`;
    let requests = {
      name: copyTitle,
      parents: ["1-A3Kh7zxITAsx8ILbPg8mfmfwD9msASi"]
    };

    this.drive.files.copy({
      fileId: CERT_SLIDE_ID,
      resource: requests,
    }, (err: string, driveResponse: any) => {
      if (err) {
        console.log(err);
      } else {
        var presentationCopyId = driveResponse.data.id;
        let requests = [{
              replaceAllText: {
                containsText: {
                  text: '{{name}}',
                  matchCase: true,
                },
                replaceText: name,
              }
            }, {
              replaceAllText: {
                containsText: {
                  text: '{{time}}',
                  matchCase: true,
                },
                replaceText: swimtime.time_orig,
              }
            }, {
              replaceAllText: {
                containsText: {
                  text: '{{race}}',
                  matchCase: true,
                },
                replaceText: recordRaceType.name,
              }
            }, {
              replaceAllText: {
                containsText: {
                  text: '{{date}}',
                  matchCase: true,
                },
                replaceText: swimtime.date,
              }
            }, {
              replaceAllText: {
                containsText: {
                  text: '{{course}}',
                  matchCase: true,
                },
                replaceText: recordRaceType.course_type,
              }
            }, {
              replaceAllText: {
                containsText: {
                  text: '{{age}}',
                  matchCase: true,
                },
                replaceText: "Age " + ageAtRecord,
              }
            }];

        console.log("Created certificate copy: " + presentationCopyId + copyTitle);

        this.slides.presentations.batchUpdate({
          presentationId: presentationCopyId,
          resource: {
            requests,
          },
        }, (err: string, batchUpdateResponse: any) => {
          if (err) {
            console.log(err);
          } else {
            let result = batchUpdateResponse;
            var dest = fs.createWriteStream('./tmp/' + copyTitle + '.pdf');
            self.drive.files.export({
              fileId: presentationCopyId,
              mimeType: 'application/pdf'
            }, {
              responseType: 'stream'
            }, function(err: string, response: any) {
                if(err) {
                  console.log(err);
                } else {
                  response.data.on('error', (err: string) => {
                     console.log(err);
                  }).on('end', () => {
                     console.log(`Created presentation for ${name} with ID: ` + presentationCopyId);
                  }).pipe(dest);
                }
            });
          }
        });
      }
    });
  }

  private updateRecord(swimmer :Swimmer, swimtime :SwimTime, recordRaceType :any, recordRow: number) {
    let self = this;
    var body = {
      values: [[swimmer.gender, swimmer.getAgeAt(swimtime.date), recordRaceType.course_type, recordRaceType.distance, self.swimData.strokes_short[recordRaceType.stroke], swimmer.getFullName(), swimtime.getDateFormatted('DD/MM/YYYY'), swimtime.time_orig]]
    }
    var range = `${TAB_RECORDS}!A${recordRow}:H`;
    this.sheets.spreadsheets.values.update({
      spreadsheetId: RECORD_SPREADSHEET,
      range: range,
      valueInputOption: "USER_ENTERED",
      resource: body,
    }, (err :string, result :any) => {
      if (err) {
        console.log(err);
      } else {
        console.log('Records sheet: Row %d cells updated.', recordRow);
      }
    });
  }

  private updateDob(swimmer :Swimmer) : Observable<Swimmer> {
    return new Observable(subscriber => {
      this.sheets.spreadsheets.values.get({
        spreadsheetId: RESPONSES_SPREADSHEET,
        range: RANGE_DOB,
      }, (err :string, res :any) => {
        if (err) return console.log('The API returned an error while reading dobs: ' + err);
        const rows = res.data.values;
        if (rows.length) {
          var currentRow = 2;
          rows.map((row :any) => {
            if(row[0] == swimmer.regno) {
              console.log(`Found swimmer: ${row}`);
              swimmer.dob = row[1];
              swimmer.gender = row[2] == "Male" ? "M" : "F";
              subscriber.next(swimmer);
            }
          });
          subscriber.complete();
        }
      });
    });
  }

  private sendNoMatchEmail(row :any, msg :string, toEmail: string) {

  }

  private sendMatchEmail(row :any, msg :string, toEmail: string) {

  }
}
