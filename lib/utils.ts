import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ============================================================
   CSV DOWNLOAD
============================================================ */
export const downloadCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
        alert("No data available to download.");
        return;
    }

    const headers = Object.keys(data[0]);

    const csvContent = [
        headers.join(","),
        ...data.map((row) =>
            headers
                .map((header) => {
                    const val = row[header];
                    let cell =
                        val === null || val === undefined ? "" : String(val);

                    // Escape quotes
                    cell = cell.replace(/"/g, '""');

                    // Wrap if contains comma, quote, newline
                    if (cell.search(/("|,|\n)/g) >= 0) {
                        cell = `"${cell}"`;
                    }

                    return cell;
                })
                .join(",")
        ),
    ].join("\n");

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
};

/* ============================================================
   PDF DOWNLOAD WITH TITLE + FOOTER + TIMESTAMP
============================================================ */
export const downloadPDF = (data: any[], filename: string, tableTitle: string) => {
    if (!data || data.length === 0) {
        alert("No data available to download.");
        return;
    }

    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        /* -----------------------------------------------
           MAIN HEADER
        ------------------------------------------------- */
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");

        const mainTitle = "Mar Augustine's HSS Library, Thuravoor";
        const mainTitleWidth = doc.getTextWidth(mainTitle);
        doc.text(mainTitle, (pageWidth - mainTitleWidth) / 2, 15);

        const now = new Date();
        const dateString = now.toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
        });

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");

        doc.text(`Report: ${tableTitle}`, 14, 25);
        doc.text(`Generated on: ${dateString}`, 14, 32);

        const headers = Object.keys(data[0]);
        const body = data.map((row) =>
            headers.map((header) => String(row[header] ?? ""))
        );

        // @ts-ignore
        autoTable(doc, {
            startY: 38,
            head: [headers],
            body: body,
            theme: "striped",
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 8, cellPadding: 2 },
            margin: { top: 30, bottom: 20 },
            didDrawPage: (dataArg: any) => {
                const footerText = "Official Library Document - MAHSS ILS";
                const footerTextWidth = doc.getTextWidth(footerText);
                const footerY = doc.internal.pageSize.getHeight() - 10;
                doc.setFontSize(9);
                doc.text(footerText, (pageWidth - footerTextWidth) / 2, footerY);
            },
        });

        doc.save(filename);
    } catch (error) {
        console.error("PDF error:", error);
        alert("Error generating PDF.");
    }
};

/* ============================================================
   SUMMARY PDF DOWNLOAD
============================================================ */
export const downloadSummaryPDF = (
    title: string, 
    stats: { Label: string, Value: string | number }[], 
    topBooks: { Rank: number, Title: string, Score: number }[], 
    topMembers: { Rank: number, Name: string, Activity: number }[]
) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        const mainTitle = "Mar Augustine's HSS Library, Thuravoor";
        doc.text(mainTitle, (pageWidth - doc.getTextWidth(mainTitle)) / 2, 15);

        doc.setFontSize(14);
        doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, 24);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 32);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("1. Operations Metrics", 14, 42);

        // @ts-ignore
        autoTable(doc, {
            startY: 45,
            head: [['Metric', 'Value']],
            body: stats.map(s => [s.Label, s.Value]),
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } },
        });

        const lastY = (doc as any).lastAutoTable.finalY || 100;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("2. Popularity Leaderboard (Books)", 14, lastY + 12);

        // @ts-ignore
        autoTable(doc, {
            startY: lastY + 15,
            head: [['Rank', 'Book Title', 'Score']],
            body: topBooks.length > 0 ? topBooks.map(b => [b.Rank, b.Title, b.Score]) : [['-', 'No activity', '-']],
            theme: 'striped',
            headStyles: { fillColor: [16, 185, 129] },
        });

        const lastY2 = (doc as any).lastAutoTable.finalY || 180;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("3. Active Patron Engagement", 14, lastY2 + 12);

        // @ts-ignore
        autoTable(doc, {
            startY: lastY2 + 15,
            head: [['Rank', 'Patron Name', 'Interactions']],
            body: topMembers.length > 0 ? topMembers.map(m => [m.Rank, m.Name, m.Activity]) : [['-', 'No activity', '-']],
            theme: 'striped',
            headStyles: { fillColor: [245, 158, 11] },
        });

        const footerY = doc.internal.pageSize.getHeight() - 10;
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text("Official MAHSS Monthly Operations Report", (pageWidth - doc.getTextWidth("Official MAHSS Monthly Operations Report")) / 2, footerY);

        doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error("Summary PDF error:", error);
    }
};