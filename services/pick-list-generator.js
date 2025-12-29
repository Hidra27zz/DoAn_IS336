// Pick List Generator Service
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PickListGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '../uploads/pick-lists');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generatePickListExcel(waveData, options = {}) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Pick List');

      // Set up headers
      worksheet.columns = [
        { header: 'Sequence', key: 'sequence', width: 10 },
        { header: 'Product Reference', key: 'productReference', width: 20 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Location', key: 'location', width: 15 },
        { header: 'Zone', key: 'zone', width: 10 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Picked', key: 'picked', width: 12 },
        { header: 'Notes', key: 'notes', width: 20 }
      ];

      // Add wave header info
      worksheet.addRow([]);
      worksheet.addRow(['Wave Number:', waveData.waveNumber]);
      worksheet.addRow(['Operator:', waveData.operator]);
      worksheet.addRow(['Priority:', waveData.priority]);
      worksheet.addRow(['Generated:', new Date().toLocaleString()]);
      worksheet.addRow([]);

      // Add tasks
      waveData.tasks.forEach((task, index) => {
        worksheet.addRow({
          sequence: index + 1,
          productReference: task.productReference,
          description: task.productDescription,
          location: task.locationCode,
          zone: task.zone,
          quantity: task.quantityToPick,
          picked: '',
          notes: task.notes || ''
        });
      });

      // Style the header
      worksheet.getRow(7).font = { bold: true };
      worksheet.getRow(7).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Save file
      const fileName = `pick-list-${waveData.waveNumber}-${Date.now()}.xlsx`;
      const filePath = path.join(this.outputDir, fileName);
      
      await workbook.xlsx.writeFile(filePath);

      return {
        success: true,
        fileName: fileName,
        filePath: filePath,
        format: 'excel',
        tasks: waveData.tasks.length
      };

    } catch (error) {
      console.error('Excel generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generatePickListPDF(waveData, options = {}) {
    try {
      const fileName = `pick-list-${waveData.waveNumber}-${Date.now()}.pdf`;
      const filePath = path.join(this.outputDir, fileName);

      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filePath));

      // Header
      doc.fontSize(20).text('PICK LIST', 50, 50);
      doc.fontSize(12);
      doc.text(`Wave Number: ${waveData.waveNumber}`, 50, 80);
      doc.text(`Operator: ${waveData.operator}`, 50, 95);
      doc.text(`Priority: ${waveData.priority}`, 50, 110);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 125);

      // Table header
      let y = 160;
      doc.text('Seq', 50, y);
      doc.text('Product', 80, y);
      doc.text('Location', 180, y);
      doc.text('Zone', 240, y);
      doc.text('Qty', 280, y);
      doc.text('Picked', 320, y);
      doc.text('Notes', 370, y);

      // Line under header
      doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();

      // Tasks
      y += 25;
      waveData.tasks.forEach((task, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc.text((index + 1).toString(), 50, y);
        doc.text(task.productReference, 80, y);
        doc.text(task.locationCode, 180, y);
        doc.text(task.zone, 240, y);
        doc.text(task.quantityToPick.toString(), 280, y);
        doc.text('____', 320, y);
        doc.text(task.notes || '', 370, y);

        y += 20;
      });

      doc.end();

      return {
        success: true,
        fileName: fileName,
        filePath: filePath,
        format: 'pdf',
        tasks: waveData.tasks.length
      };

    } catch (error) {
      console.error('PDF generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PickListGenerator;