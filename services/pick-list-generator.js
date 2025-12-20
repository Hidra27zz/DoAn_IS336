// Pick List Generator Service
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

class PickListGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, '../uploads/pick-lists');
        this.ensureOutputDirectory();
    }

    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async generatePickListPDF(waveData, options = {}) {
        try {
            const fileName = `pick-list-${waveData.waveNumber}-${Date.now()}.pdf`;
            const filePath = path.join(this.outputDir, fileName);

            const doc = new PDFDocument({ margin: 50 });
            doc.pipe(fs.createWriteStream(filePath));

            // Header
            this.addPDFHeader(doc, waveData);
            
            // Wave Information
            this.addWaveInfo(doc, waveData);
            
            // Pick List Table
            await this.addPickListTable(doc, waveData.tasks, options);
            
            // Footer
            this.addPDFFooter(doc, waveData);

            doc.end();

            return {
                success: true,
                fileName: fileName,
                filePath: filePath,
                downloadUrl: `/api/pick-lists/download/${fileName}`
            };
        } catch (error) {
            console.error('Error generating PDF pick list:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async generatePickListExcel(waveData, options = {}) {
        try {
            const fileName = `pick-list-${waveData.waveNumber}-${Date.now()}.xlsx`;
            const filePath = path.join(this.outputDir, fileName);

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Pick List');

            // Set column widths
            worksheet.columns = [
                { header: 'Seq', key: 'sequence', width: 8 },
                { header: 'Product', key: 'product', width: 15 },
                { header: 'Description', key: 'description', width: 25 },
                { header: 'Location', key: 'location', width: 12 },
                { header: 'Zone', key: 'zone', width: 8 },
                { header: 'Qty to Pick', key: 'quantity', width: 12 },
                { header: 'Picked Qty', key: 'pickedQty', width: 12 },
                { header: 'Notes', key: 'notes', width: 20 }
            ];

            // Add header information
            worksheet.addRow([]);
            worksheet.addRow(['PICK LIST']);
            worksheet.addRow(['Wave Number:', waveData.waveNumber]);
            worksheet.addRow(['Generated:', new Date().toLocaleString()]);
            worksheet.addRow(['Operator:', waveData.operator || 'Unassigned']);
            worksheet.addRow(['Total Items:', waveData.tasks.length]);
            worksheet.addRow([]);

            // Style header
            worksheet.getRow(2).font = { size: 16, bold: true };
            worksheet.getRow(2).alignment = { horizontal: 'center' };

            // Add tasks
            const sortedTasks = this.sortTasksForPicking(waveData.tasks, options);
            
            sortedTasks.forEach((task, index) => {
                worksheet.addRow({
                    sequence: index + 1,
                    product: task.productReference,
                    description: task.productDescription || '',
                    location: task.locationCode,
                    zone: task.zone,
                    quantity: task.quantityToPick,
                    pickedQty: '',
                    notes: task.notes || ''
                });
            });

            // Style the data table
            const headerRow = worksheet.getRow(8);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6E6FA' }
            };

            await workbook.xlsx.writeFile(filePath);

            return {
                success: true,
                fileName: fileName,
                filePath: filePath,
                downloadUrl: `/api/pick-lists/download/${fileName}`
            };
        } catch (error) {
            console.error('Error generating Excel pick list:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    addPDFHeader(doc, waveData) {
        // Company header
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('WAREHOUSE PICK LIST', 50, 50);

        // Wave information box
        doc.rect(50, 80, 500, 80)
           .stroke();

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Wave Number:', 60, 95)
           .font('Helvetica')
           .text(waveData.waveNumber, 150, 95);

        doc.font('Helvetica-Bold')
           .text('Generated:', 60, 115)
           .font('Helvetica')
           .text(new Date().toLocaleString(), 150, 115);

        doc.font('Helvetica-Bold')
           .text('Operator:', 300, 95)
           .font('Helvetica')
           .text(waveData.operator || 'Unassigned', 360, 95);

        doc.font('Helvetica-Bold')
           .text('Total Items:', 300, 115)
           .font('Helvetica')
           .text(waveData.tasks.length.toString(), 360, 115);

        doc.font('Helvetica-Bold')
           .text('Priority:', 300, 135)
           .font('Helvetica')
           .text(waveData.priority || 'Normal', 360, 135);
    }

    addWaveInfo(doc, waveData) {
        let yPosition = 180;

        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Wave Summary:', 50, yPosition);

        yPosition += 25;

        const summary = this.generateWaveSummary(waveData.tasks);
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Total Locations to Visit: ${summary.totalLocations}`, 60, yPosition);
        
        yPosition += 15;
        doc.text(`Estimated Travel Distance: ${summary.estimatedDistance}m`, 60, yPosition);
        
        yPosition += 15;
        doc.text(`Estimated Pick Time: ${summary.estimatedTime} minutes`, 60, yPosition);

        return yPosition + 30;
    }

    async addPickListTable(doc, tasks, options) {
        let yPosition = 250;
        const sortedTasks = this.sortTasksForPicking(tasks, options);

        // Table headers
        doc.fontSize(10)
           .font('Helvetica-Bold');

        const headers = ['Seq', 'Product', 'Location', 'Zone', 'Qty', 'Picked', 'Notes'];
        const columnWidths = [40, 80, 80, 50, 50, 50, 150];
        let xPosition = 50;

        // Draw header row
        headers.forEach((header, index) => {
            doc.text(header, xPosition, yPosition, { width: columnWidths[index] });
            xPosition += columnWidths[index];
        });

        // Draw header line
        yPosition += 20;
        doc.moveTo(50, yPosition)
           .lineTo(550, yPosition)
           .stroke();

        yPosition += 10;

        // Add tasks
        doc.font('Helvetica');
        sortedTasks.forEach((task, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            xPosition = 50;
            const rowData = [
                (index + 1).toString(),
                task.productReference,
                task.locationCode,
                task.zone,
                task.quantityToPick.toString(),
                '', // Picked quantity (to be filled manually)
                task.notes || ''
            ];

            rowData.forEach((data, colIndex) => {
                doc.text(data, xPosition, yPosition, { 
                    width: columnWidths[colIndex],
                    height: 15,
                    ellipsis: true
                });
                xPosition += columnWidths[colIndex];
            });

            yPosition += 20;

            // Add line between rows
            if (index % 5 === 4) {
                doc.moveTo(50, yPosition)
                   .lineTo(550, yPosition)
                   .stroke();
                yPosition += 5;
            }
        });
    }

    addPDFFooter(doc, waveData) {
        const pageCount = doc.bufferedPageRange().count;
        
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            
            // Footer line
            doc.moveTo(50, 750)
               .lineTo(550, 750)
               .stroke();

            // Footer text
            doc.fontSize(8)
               .font('Helvetica')
               .text(`Pick List - Wave ${waveData.waveNumber}`, 50, 760)
               .text(`Page ${i + 1} of ${pageCount}`, 450, 760)
               .text(`Generated: ${new Date().toLocaleString()}`, 50, 775);
        }
    }

    sortTasksForPicking(tasks, options = {}) {
        let sortedTasks = [...tasks];

        if (options.sortBy === 'location') {
            // Sort by location code
            sortedTasks.sort((a, b) => a.locationCode.localeCompare(b.locationCode));
        } else if (options.sortBy === 'zone') {
            // Sort by zone, then by location
            sortedTasks.sort((a, b) => {
                if (a.zone !== b.zone) {
                    return a.zone.localeCompare(b.zone);
                }
                return a.locationCode.localeCompare(b.locationCode);
            });
        } else if (options.sortBy === 'route') {
            // Sort by optimized route (if available)
            if (options.optimizedRoute) {
                const routeOrder = {};
                options.optimizedRoute.forEach((item, index) => {
                    routeOrder[item.locationCode] = index;
                });
                
                sortedTasks.sort((a, b) => {
                    const orderA = routeOrder[a.locationCode] || 999;
                    const orderB = routeOrder[b.locationCode] || 999;
                    return orderA - orderB;
                });
            }
        }

        return sortedTasks;
    }

    generateWaveSummary(tasks) {
        const uniqueLocations = new Set(tasks.map(task => task.locationCode));
        const totalQuantity = tasks.reduce((sum, task) => sum + task.quantityToPick, 0);
        
        // Estimate travel distance (simplified calculation)
        const estimatedDistance = uniqueLocations.size * 15; // 15m average between locations
        
        // Estimate pick time (2 minutes per location + 30 seconds per item)
        const estimatedTime = Math.round(uniqueLocations.size * 2 + totalQuantity * 0.5);

        return {
            totalLocations: uniqueLocations.size,
            totalQuantity: totalQuantity,
            estimatedDistance: estimatedDistance,
            estimatedTime: estimatedTime
        };
    }

    async generateBarcodePickList(waveData, options = {}) {
        // Enhanced version with barcode support
        // This would require additional barcode generation library
        // For now, return standard PDF with barcode placeholders
        
        const result = await this.generatePickListPDF(waveData, {
            ...options,
            includeBarcodes: true
        });

        return result;
    }

    getPickListMetadata(fileName) {
        const filePath = path.join(this.outputDir, fileName);
        
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const stats = fs.statSync(filePath);
        return {
            fileName: fileName,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        };
    }

    deletePickList(fileName) {
        const filePath = path.join(this.outputDir, fileName);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        
        return false;
    }
}

module.exports = PickListGenerator;