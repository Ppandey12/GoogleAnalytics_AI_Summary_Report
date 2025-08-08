function callOpenAIAPI(total_report) {
     const OPENAI_API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
     const model = 'gpt-4.1-mini';
     const instructions = "# Identity You are an assistant that helps summarize website traffic reports and provides insights on how to improve the website based on the report given. # Instructions * When responding, focus on summarizing the provided website traffic report clearly and concisely. * Provide actionable insights on how the website can improve traffic and engagement. * The summary must be structured as a single, coherent paragraph without bullet points and cannot exceed more than 1300 characters. * Write in a narrative style similar to the example provided below. # Summary Example The dataset tracks active user engagement across various countries for the Yale College sites from June 1, 2025, to June 30, 2025. It consists of 4,356 records, capturing a total of 91,356 active users. The analysis reveals a broad variation in the number of active users per country, with the mean number of active users being approximately 21, and a standard deviation of 513, suggesting substantial diversity in user engagement across different locations. The countries with the highest number of active users are prominently led by \"English\" with 21,872 users and \"US\" with 18,099 users. These regions are followed by \"New York\" with 2,221 users, \"New Haven\" with 2,086 users, and \"Los Angeles\" with 1,500 users. Overall, these top countries account for a significant proportion of the total user engagement recorded in the dataset. The concentration in regions like \"English\" and \"US\" underscores significant user engagement in these areas for the specified period. Additional insights indicate that the distribution of users is skewed, with a small number of countries contributing a large share of active users. The median number of active users per country is only 1, indicating that a majority of countries have relatively low engagement, while a few regions exhibit very high user activity. This distribution can help in understanding focus areas and engaging further with highly active regions to capitalize on already established user bases."

     const prompt = "Given the following report:\n" + total_report + "What can I do to improve traffic to other pages?";



     const url = 'https://api.openai.com/v1/chat/completions';

     const headers = {
       'Authorization': 'Bearer ' + OPENAI_API_KEY,
       'Content-Type': 'application/json'
     };

     const payload = JSON.stringify({
       model: model,
       messages: [{ role: 'user', content: instructions + '\n' + prompt }],
     });

     const options = {
       method: 'post',
       headers: headers,
       payload: payload,
       muteHttpExceptions: true // Essential for debugging errors
     };

     const response = UrlFetchApp.fetch(url, options);
     const responseText = response.getContentText();
     const jsonResponse = JSON.parse(responseText);

     return jsonResponse.choices[0].message.content;
   }


function formatDate(date) {
  var year = date.getFullYear();
  var month = ('0' + (date.getMonth() + 1)).slice(-2);
  var day = ('0' + date.getDate()).slice(-2);

  return year + '-' + month + '-' + day;

}

function getDates() {
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth();

  var startDate = new Date(year, month, 1);
  var endDate = new Date(year, month + 1, 0);

  var startDateStr = formatDate(startDate);
  var endDateStr = formatDate(endDate);

  return {
    startDate: startDateStr,
    endDate: endDateStr
  };
}

function getMonthAndYearName() {
  var dates = getDates(); // returns strings like "2025-08-01"
  // Reconstruct a Date object

  var parts = dates.startDate.split('-');
  var year = parseInt(parts[0],10);
  var month = parseInt(parts[1],10) - 1;
  var day = parseInt(parts[2],10);

  const dateObj = new Date(year, month, day);

  var monthName = dateObj.toLocaleString('default', { month: 'long' });
  var yearName = dateObj.getFullYear();

  return monthName + ' ' + yearName;
}

function runReport() {
  const propertyId = PropertiesService.getScriptProperties().getProperty('WEBSITE_PROPERTY_ID');

  try {
    const metric = AnalyticsData.newMetric();
    metric.name = 'screenPageViews';

    const dimension = AnalyticsData.newDimension();
    dimension.name = 'pageTitle';

    const dateRange = AnalyticsData.newDateRange();
    dateRange.startDate = getDates().startDate;
    dateRange.endDate = getDates().endDate;

    const request = AnalyticsData.newRunReportRequest();
    request.dimensions = [dimension];
    request.metrics = [metric];
    request.dateRanges = dateRange;

    const report = AnalyticsData.Properties.runReport(request,
        'properties/' + propertyId);

    if (!report.rows) {
      console.log('No rows returned.');
      return;
    }

    const spreadsheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
    try {
    const sheet = spreadsheet.insertSheet(getMonthAndYearName());
    } catch (e) {
      sheet = spreadsheet.getSheetByName(getMonthAndYearName());
    }
    // Append the headers.

    let total_report = '';

    const metricHeaders = report.metricHeaders.map(
        (metricHeader) => {
          total_report += metricHeader.name + ' ';
          return metricHeader.name;
        });

    const dimensionHeaders = report.dimensionHeaders.map(
        (dimensionHeader) => {
          total_report += dimensionHeader.name + '\n';
          return dimensionHeader.name;
        });

    const headers = [...dimensionHeaders, ...metricHeaders];

    sheet.appendRow(headers);

    // Append the results.
    const rows = report.rows.map((row) => {
      const metricValues = row.metricValues.map(
          (metricValues) => {
            total_report += metricValues.value + " ";
            return metricValues.value;
          });
      const dimensionValues = row.dimensionValues.map(
          (dimensionValue) => {
            total_report += dimensionValue.value + "\n";
            return dimensionValue.value;
          });
      return [...dimensionValues, ...metricValues];
    });

    const summary = callOpenAIAPI(total_report);

    console.log(summary);

    var summary_sheet = spreadsheet.getSheetByName("GenAI Summary");
    var cell = summary_sheet.getRange("A2");
    cell.setValue(summary);

    sheet.getRange(2, 1, report.rows.length, headers.length)
        .setValues(rows);

    console.log('Report spreadsheet can be seen here: %s',
        spreadsheet.getUrl());


  } catch (e) {
    // TODO (Developer) - Handle exception
    console.log('Failed with error: %s', e.error);
  }
}
 
