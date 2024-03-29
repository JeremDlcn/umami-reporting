const ImagesToPDF = require('images-pdf');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();
const nodemailer = require('nodemailer');
const path = require('path');


//Check if the folder "files" exist
if (!fs.existsSync('files')) fs.mkdirSync(`files`);

//Email configuration
const dateForContent = new Date();
const message = {
    from: process.env.SENDER_EMAIL,
    to: process.env.RECEIVER_EMAIL,
    subject: 'Monthly Reporting - ' + dateForContent.toLocaleString('default', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
    text: 'Here is your Reportings for the month, all files are in attachments',
    attachments: []
}

const transporter = nodemailer.createTransport({ 
    host: 'smtp-mail.outlook.com', secureConnection: false, port: 587, tls:{ ciphers: 'SSLv3' },
    auth:{ user: process.env.SENDER_EMAIL, pass: process.env.SENDER_PASS }
});


(async () => {
    const browser = await puppeteer.launch({headless: true, ignoreHTTPSErrors: true});
    const page = await browser.newPage();
    await page.setViewport({width: 1060,height: 745});
    await page.goto(process.env.URL);
    // Login
    await page.type('input[name=username]', process.env.USER);
    await page.type('input[name=password]', process.env.PASSWORD);
    await page.click('button[type=submit]');
    //List of all website
    await page.waitForNavigation();
    await page.waitForSelector('a[href*="settings"]')
    await page.click('a[href*="settings"]')
    // Capture all websites
    await page.waitForNavigation();
    
    await page.waitForSelector('div[class*="Table_body"]')

    const data = await page.evaluate(() => {
        let final = [];
        document.querySelectorAll('div[class*="Table_body"] .row a').forEach(elt => {final.push({name: elt.textContent ,url:elt.href})})
        return final
    })
    
    
    for (const [i, site] of data.entries()) {
        await page.goto(site.url);
        
        //Select the month view
        await page.waitForSelector('div[class*="Dropdown_dropdown"]');
        await page.click('div[class*="Dropdown_dropdown"]');
        await page.waitForSelector('div[class*="Menu_option"]:nth-of-type(5)');
        await page.click('div[class*="Menu_option"]:nth-of-type(5)');
        //Capture the page
        await page.waitForSelector('.rsm-geographies');
        await page.waitForTimeout(1000)
        
        await page.evaluate(()=>{
            document.querySelector('nav').remove()//remove update notifications dans nav
            document.querySelector('div[class*="Footer"]').remove()//remove version number
            document.querySelector('div[class*="PageHeader_header"] div[class*="ButtonLayout_buttons"]').remove()//remove "refresh" button
            document.querySelectorAll('div[class*="MetricsTable_footer"]').forEach(elt=> {
                elt.remove()
            })//remove "more" buttons
            document.querySelector('div[class*="WebsiteHeader_title"] div').style.fontWeight = "bold"
        })

        if (!fs.existsSync(`files/${site.name}`)) fs.mkdirSync(`files/${site.name}`);
        await page.screenshot({ path: `files/${site.name}/umami-export.png`, fullPage: true })
        new ImagesToPDF.ImagesToPDF().convertFolderToPDF(`files/${site.name}`, `files/Reporting-${site.name}.pdf`);

        message.attachments.push({
            filename: `Reporting-${site.name}.pdf`,
            path: path.resolve(`files/Reporting-${site.name}.pdf`),
            contentType: 'application/pdf'
        })
    }


    transporter.sendMail(message)
    transporter.close();

    
    await browser.close();
})();







