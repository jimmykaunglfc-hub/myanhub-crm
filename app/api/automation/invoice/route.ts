import { NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// We use the service key so the server has permission to bypass RLS and upload the PDF
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Verify this is an UPDATE event coming from the orders table
    if (payload.type === 'UPDATE' && payload.table === 'orders') {
      const oldRecord = payload.old_record;
      const newRecord = payload.record;

      // 🚀 THE TRIGGER: Only fire if the status JUST changed to 'delivered'
      if (newRecord.delivery_state === 'delivered' && oldRecord?.delivery_state !== 'delivered') {
        
        // 🔥 Send an instant 200 OK back to Supabase so the webhook doesn't time out!
        const immediateResponse = NextResponse.json({ success: true, status: 'Generating PDF in background' }, { status: 200 });

        // 🚀 OFFLOAD TO BACKGROUND
        after(async () => {
          try {
            const customerId = newRecord.customer_id;
            const userId = newRecord.user_id; 
            const orderId = newRecord.order_id_string;
            const amount = newRecord.total_amount;
            
            // 1. Fetch the workspace profile for the Shop Name & Currency
            const { data: profile } = await supabase
               .from('profiles')
               .select('currency_code, full_name, business_name')
               .eq('id', userId)
               .single();
               
            const currency = profile?.currency_code || 'MMK';
            const shopName = profile?.business_name || profile?.full_name || 'MyanHub Merchant';

            // 2. Generate the PDF Document
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([600, 500]); // Width, Height
            const { height } = page.getSize();
            
            const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            // Draw Header
            page.drawText(shopName, { x: 50, y: height - 60, size: 28, font: boldFont, color: rgb(0.1, 0.1, 0.4) });
            page.drawText('OFFICIAL RECEIPT / INVOICE', { x: 50, y: height - 90, size: 14, font: standardFont, color: rgb(0.4, 0.4, 0.4) });
            
            // Draw Divider Line
            page.drawLine({ start: { x: 50, y: height - 110 }, end: { x: 550, y: height - 110 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

            // Draw Order Details
            page.drawText(`Order Number: ${orderId}`, { x: 50, y: height - 150, size: 12, font: boldFont });
            page.drawText(`Delivery Status: Delivered`, { x: 50, y: height - 175, size: 12, font: standardFont });
            page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y: height - 200, size: 12, font: standardFont });
            
            // Draw Total Amount
            page.drawText(`Total Paid:`, { x: 50, y: height - 260, size: 16, font: standardFont });
            page.drawText(`${amount} ${currency}`, { x: 150, y: height - 260, size: 16, font: boldFont, color: rgb(0.1, 0.6, 0.2) });

            page.drawText('Thank you for your business!', { x: 50, y: 50, size: 12, font: standardFont, color: rgb(0.5, 0.5, 0.5) });

            // Save PDF to memory
            const pdfBytes = await pdfDoc.save();
            const fileName = `receipts/${orderId}-${Date.now()}.pdf`;

            // 3. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
              .from('invoices')
              .upload(fileName, pdfBytes, {
                contentType: 'application/pdf',
                upsert: false
              });

            if (uploadError) throw new Error(uploadError.message);

            // 4. Get the Public URL of the generated PDF
            const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(fileName);
            const publicPdfUrl = urlData.publicUrl;

            // 5. Send the Message + PDF Link to the customer
            const receiptText = `📦 [Delivery Complete]\n\nGreat news! Your order ${orderId} has been successfully delivered.\n\n📄 View and download your official invoice here: \n${publicPdfUrl}`;

            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://co.myanhub.com';
            await fetch(`${baseUrl}/api/send-message`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ customerId, text: receiptText, userId })
            });

          } catch (bgError: any) {
            console.error("Background PDF Generation Error:", bgError.message);
          }
        });

        return immediateResponse;
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("Auto-Invoice Entry Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}