const express = require('express');
const archiver = require('archiver');

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

async function getBrowser() {
    if (isProduction) {
        const chromium = require('@sparticuz/chromium');
        const puppeteerCore = require('puppeteer-core');
        return await puppeteerCore.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });
    } else {
        const puppeteer = require('puppeteer');
        return await puppeteer.launch({ headless: 'new' });
    }
}
const { PDFDocument } = require('pdf-lib');
const cors = require('cors');
const path = require('path');

// Utility function to auto-scroll page to trigger lazy loaded images
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint 1: Extract links
app.post('/api/extract', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let browser;
    try {
        console.log(`Extracting links from: ${url}`);
        browser = await getBrowser();
        const page = await browser.newPage();
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        const origin = new URL(url).origin;
        const links = await page.evaluate((origin) => {
            const anchors = Array.from(document.querySelectorAll('a'));
            const extracted = [];
            const seen = new Set();
            
            for (let a of anchors) {
                let href = a.href;
                if (!href) continue;
                
                if (href.includes('javascript:') || href.includes('login') || href.includes('logout') || href.includes('mailto:')) continue;
                
                href = href.split('#')[0];
                
                if (href.startsWith(origin)) {
                    let text = a.innerText.trim();
                    if (!text) text = href.replace(origin, '');
                    if (!text || text === '/') text = 'Home / ' + href.split('/').pop();
                    
                    if (!seen.has(href)) {
                        seen.add(href);
                        extracted.push({ url: href, title: text });
                    }
                }
            }
            return extracted;
        }, origin);

        res.json({ links });
    } catch (error) {
        console.error('Extraction error:', error);
        res.status(500).json({ error: 'Failed to extract links', details: error.message, stack: error.stack });
    } finally {
        if (browser) await browser.close();
    }
});

// Endpoint 2: Download ZIP
app.post('/api/download-zip', async (req, res) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Array of URLs is required' });
    }

    let browser;
    try {
        console.log(`Starting PDF generation for ${urls.length} URLs`);
        browser = await getBrowser();
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        res.attachment('KnowledgeBase-Export.zip');
        archive.pipe(res);

        for (let i = 0; i < urls.length; i++) {
            const targetUrl = urls[i];
            console.log(`Processing [${i+1}/${urls.length}]: ${targetUrl}`);
            
            const page = await browser.newPage();
            try {
                // Set User-Agent to prevent bot detection and allow image loading
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1280, height: 1024 });
                await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
                
                // Scroll page and wait briefly to ensure images load
                await autoScroll(page);
                await new Promise(r => setTimeout(r, 2000));

                const pdfBuffer = await page.pdf({
                    format: 'A4',
                    printBackground: true,
                    margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }
                });

                let filename = targetUrl.split('/').pop() || `document-${i+1}`;
                filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
                if (filename === '.pdf') filename = `document-${i+1}.pdf`;
                
                archive.append(pdfBuffer, { name: filename });
                
            } catch (err) {
                console.error(`Error processing ${targetUrl}:`, err);
            } finally {
                await page.close();
            }
        }

        archive.finalize();
        
    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate PDF bundle', details: error.message, stack: error.stack });
        }
    } finally {
        if (browser) await browser.close();
    }
});

// Endpoint 3: Download Single PDF
app.post('/api/download-single', async (req, res) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Array of URLs is required' });
    }

    let browser;
    try {
        console.log(`Starting PDF merge for ${urls.length} URLs`);
        browser = await getBrowser();
        
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < urls.length; i++) {
            const targetUrl = urls[i];
            console.log(`Processing & Merging [${i+1}/${urls.length}]: ${targetUrl}`);
            
            const page = await browser.newPage();
            try {
                // Set User-Agent to prevent bot detection and allow image loading
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1280, height: 1024 });
                await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
                
                // Scroll page and wait briefly to ensure images load
                await autoScroll(page);
                await new Promise(r => setTimeout(r, 2000));

                const pdfBuffer = await page.pdf({
                    format: 'A4',
                    printBackground: true,
                    margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }
                });

                const document = await PDFDocument.load(pdfBuffer);
                const copiedPages = await mergedPdf.copyPages(document, document.getPageIndices());
                copiedPages.forEach((p) => mergedPdf.addPage(p));
                
            } catch (err) {
                console.error(`Error processing ${targetUrl}:`, err);
            } finally {
                await page.close();
            }
        }

        const mergedPdfFile = await mergedPdf.save();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="KnowledgeBase-Merged.pdf"');
        res.send(Buffer.from(mergedPdfFile));
        
    } catch (error) {
        console.error('Download single error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate merged PDF', details: error.message, stack: error.stack });
        }
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
