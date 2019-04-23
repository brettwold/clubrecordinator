import fs = require('fs');
import readline = require('readline');

import { google } from 'googleapis';
import { AsaService } from './asa.service';
import { DefaultSwimData }  from '../models/default.swimdata';
import { SwimTime } from '../models/swimtime';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = './token.json';
const TARGET_SPREADSHEET = '1SLGdn2I07mtM8cesfShDrAE5Xpfj7DY9lBiQoRJWgUM';

export class GoogleService {
  private swimData :any;

  constructor () {
    this.swimData = DefaultSwimData.DATA;
  }

  parseResponses() {
    let self = this;
    fs.readFile('./credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      // Authorize a client with credentials, then call the Google Sheets API.
      this.authorize(JSON.parse(content.toString()));
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
    let oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return self.getNewToken(oAuth2Client);
      oAuth2Client.setCredentials(JSON.parse(token.toString()));
      self.listMajors(oAuth2Client);
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   */
  getNewToken(oAuth2Client :any) {
    let self = this;
    const authUrl = oAuth2Client.generateAuthUrl({
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
      oAuth2Client.getToken(code, (err :string, token :any) => {
        if (err) return console.error('Error while trying to retrieve access token', err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
        self.listMajors(oAuth2Client);
      });
    });
  }


  /**
   * Prints the names and majors of students in a sample spreadsheet:
   * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
   * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
   */
  listMajors(auth :any) {
    let self = this;

    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.get({
      spreadsheetId: TARGET_SPREADSHEET,
      range: "'Form responses 1'!B2:I2",
    }, (err :string, res :any) => {
      if (err) return console.log('The API returned an error: ' + err);
      const rows = res.data.values;
      if (rows.length) {
        console.log('Email, ASA, Name, Course, Distance, Stroke, Date Set, Time, Processed:');
        // Print columns A and E, which correspond to indices 0 and 4.
        rows.map((row :any) => {
          console.log(`${row[0]}, ${row[1]}, ${row[2]}, ${row[3]}, ${row[4]}, ${row[5]}, ${row[6]}, ${row[7]}, ${row[8]}`);

          const asaService = new AsaService();
          asaService.getSwimmer(row[1]).subscribe(swimmer => {
            self.markAsProcessed(row);
            let recordTime :SwimTime = asaService.findTimeMatch(swimmer, row[3], row[4], row[5], row[6], row[7]);
            if(recordTime.time > 0) {
              console.log('Time match found');
              console.log(recordTime);
              self.updateRecord(recordTime);
              self.sendMatchEmail(row);
            } else {
              console.log('No time match found');
              self.sendNoMatchEmail(row);
            }
          });
        });
      } else {
        console.log('No data found.');
      }
    });
  }

  private markAsProcessed(responseRow :any) {

  }

  private updateRecord(swimtime :SwimTime) {

  }

  private sendNoMatchEmail(row :any) {

  }

  private sendMatchEmail(row :any) {

  }
}
