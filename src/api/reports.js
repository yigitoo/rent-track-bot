const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const { requireWebAuth } = require('../utils/webAuth');
const { annualReport, combinedReport, monthReport, rangeReport } = require('../services/reportData');
const busService = require('../services/bus');
const {
  buildAnnualReportPdf,
  buildBusMonthReportPdf,
  buildCombinedReportPdf,
  buildMonthReportPdf,
  buildRangeReportPdf,
  fileNameFor,
} = require('../utils/pdfReport');
const { parsePeriod } = require('../utils/api');

function streamPdf(res, doc, fileName) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);
  doc.end();
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireWebAuth(req, res)) return;

  try {
    if (mongoose.connection.readyState !== 1) await connectDB();

    const wantsPdf = String(req.query.format || '') === 'pdf';
    const scope = String(req.query.scope || 'range');

    if (scope === 'bus') {
      const { month, year } = parsePeriod(req.query);
      const report = await busService.monthReport({ month, year, busId: String(req.query.busId || '') });
      if (!wantsPdf) return res.status(200).json(report);
      return streamPdf(res, buildBusMonthReportPdf(report), fileNameFor('bus', year, month));
    }

    if (scope === 'combined') {
      const requested = Number(req.query.months);
      const months = Number.isInteger(requested) && requested >= 3 && requested <= 24 ? requested : 12;
      const report = await combinedReport(months);
      if (!wantsPdf) return res.status(200).json(report);
      return streamPdf(res, buildCombinedReportPdf(report), fileNameFor('combined', months));
    }

    if (scope === 'month') {
      const { month, year } = parsePeriod(req.query);
      const report = await monthReport(month, year);
      if (!wantsPdf) return res.status(200).json(report);
      return streamPdf(res, buildMonthReportPdf(report), fileNameFor('month', year, month));
    }

    if (scope === 'annual') {
      const currentYear = new Date().getFullYear();
      const requested = Number(req.query.year);
      const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100
        ? requested
        : currentYear;

      const annual = await annualReport(year);
      if (!wantsPdf) return res.status(200).json(annual);
      return streamPdf(res, buildAnnualReportPdf(annual), fileNameFor('annual', year));
    }

    const requested = Number(req.query.months);
    const monthCount = Number.isInteger(requested) && requested >= 3 && requested <= 24 ? requested : 12;
    const report = await rangeReport(monthCount);

    if (!wantsPdf) return res.status(200).json(report);
    return streamPdf(res, buildRangeReportPdf(report), fileNameFor('range', monthCount));
  } catch (error) {
    console.error('Reports API error:', error);
    if (res.headersSent) return undefined;
    return res.status(500).json({ error: 'Rapor verisi alınamadı.' });
  }
};
