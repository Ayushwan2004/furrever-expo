import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { CertificateType, CertificateContextType } from "@/types";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "@/constants/themes";

// ─── Extended context type (add generateQR) ───────────────────────────────────
// If you want to expose generateQR from the context, extend CertificateContextType
// in types.ts:
//   generateQR: (serialCode: string) => string;
// For now we export it as a standalone helper too (see bottom of file).

const CertificateContext = createContext<CertificateContextType | undefined>(
  undefined
);

// ─── QR URL helper ────────────────────────────────────────────────────────────
// Generates the verify URL that encodes the certificate ID.
// The web page at /verify-certificate reads ?id= from the URL to pre-fill the field.
export function buildVerifyUrl(serialCode: string): string {
  return `https://furrever.netlify.app/verify-certificate?id=${encodeURIComponent(serialCode)}`;
}

// ─── QR SVG string (Google Charts API — no native dep needed) ─────────────────
// Returns a data-URL-ready <img> src string for use in HTML templates.
export function buildQrImgUrl(serialCode: string, size = 200): string {
  const url = buildVerifyUrl(serialCode);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png&qzone=1&color=1b1a18&bgcolor=fff4e3`;
}

// ─── Provider ────────────────────────────────────────────────────────────────
export const CertificateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loading, setLoading] = useState(false);
  const lockRef = useRef(false);

  const downloadPDF = useCallback(async (cert: CertificateType) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setLoading(true);

    const date = cert.issuedAt?.toDate
      ? cert.issuedAt.toDate().toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : new Date().toLocaleDateString();

    // Dynamic QR code that points to the verify page with CERT-ID prefilled
    const qrImgUrl  = buildQrImgUrl(cert.serialCode, 220);
    const verifyUrl = buildVerifyUrl(cert.serialCode);

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
      html, body { width: 100%; height: 100%; overflow: hidden; background-color: #fff; font-family: 'Helvetica Neue', Arial, sans-serif; }
      .page { width: 100vw; height: 100vh; padding: 35px; display: flex; justify-content: center; align-items: center; }
      .outer-border { width: 100%; height: 100%; border: 10px solid ${colors.primary}; padding: 6px; position: relative; background-image: radial-gradient(circle, ${colors.primary}08 1.5px, transparent 1.5px); background-size: 28px 28px; }
      .watermark-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; overflow: hidden; }
      .main-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); font-size: 75pt; font-weight: 900; color: ${colors.primary}; opacity: 0.04; white-space: nowrap; letter-spacing: 10px; }
      .inner-border { position: relative; z-index: 10; flex: 1; border: 2.5px solid ${colors.primary}; padding: 28px 50px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; background-color: rgba(255, 255, 255, 0.88); }
      .logo { font-size: 45pt; font-weight: 900; color: ${colors.primary}; letter-spacing: -1.5px; line-height: 1; }
      .pet-photo { width: 130px; height: 130px; border-radius: 50%; object-fit: cover; border: 5px solid ${colors.primary}; box-shadow: 0 10px 20px rgba(0,0,0,0.1); margin: 10px 0; }
      .name-highlight { font-size: 26pt; font-weight: 800; color: #222; border-bottom: 2pt solid ${colors.primary}35; display: inline-block; padding: 0 40px; margin-bottom: 10px; }

      /* Footer: three-column — serial/official | seal | QR block */
      .footer { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 12px; }
      .footer-left { text-align: left; }
      .footer-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
      .seal { width: 95px; height: 95px; border: 3.5px double ${colors.primary}; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: ${colors.primary}; transform: rotate(-15deg); background-color: #fff; flex-shrink: 0; }

      /* QR block */
      .qr-block { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
      .qr-img { width: 80px; height: 80px; border: 1.5px solid ${colors.primary}40; border-radius: 6px; padding: 2px; background: #fff; }
      .qr-label { font-size: 6.5pt; color: #aaa; font-weight: 700; letter-spacing: .04em; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="outer-border">
        <div class="watermark-container"><div class="main-watermark">FURREVER VERIFIED</div></div>
        <div class="inner-border">

          <div>
            <h1 class="logo">FurrEver</h1>
            <p style="text-transform: uppercase; letter-spacing: 8px; font-size: 13pt; color: #666;">Certificate of Adoption</p>
          </div>

          <img src="${cert.petImage}" class="pet-photo" />

          <div>
            <p style="font-size: 14pt; color: #777; font-style: italic;">This officially certifies that</p>
            <div class="name-highlight">${cert.adopterName}</div>
            <p style="font-size: 14pt; color: #777; font-style: italic;">has provided a loving forever home to</p>
            <div class="name-highlight" style="color: ${colors.primary};">${cert.petName}</div>
            <p style="font-size: 15pt; color: #333; margin-top: 8px;">A beautiful <b>${cert.breed}</b> ${cert.category}</p>
            <p style="font-size: 11pt; color: #888; margin-top: 12px;">Witnessed and validated on: <b>${date}</b></p>
          </div>

          <div class="footer">
            <!-- Left: serial + official label -->
            <div class="footer-left">
              <p style="font-family: monospace; font-size: 10pt; color: #aaa; font-weight: bold;">${cert.serialCode}</p>
              <p style="color: ${colors.primary}; font-weight: 900; font-size: 12pt; letter-spacing: 2px;">OFFICIAL RECORD</p>
              <p style="color: #aaa; font-weight: 700; font-size: 7pt; letter-spacing: 2px;">Secured & Verified — FurrEver</p>
            </div>

            <!-- Center: wax seal -->
            <div class="seal">
              <span style="font-size: 28pt;">🐾</span>
              <span style="font-size: 9pt; font-weight: 900;">FurrEver</span>
            </div>

            <!-- Right: QR + label -->
            <div class="qr-block">
              <img src="${qrImgUrl}" class="qr-img" />
              <span class="qr-label">Scan to verify</span>
              <span class="qr-label" style="font-size:5.5pt; color:#ccc;">${verifyUrl}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  </body>
</html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
      });
    } catch (e) {
      console.error("PDF Generation Error:", e);
    } finally {
      setLoading(false);
      lockRef.current = false;
    }
  }, []);

  const value = useMemo(
    () => ({ loading, downloadPDF }),
    [loading, downloadPDF]
  );

  return (
    <CertificateContext.Provider value={value}>
      {children}
    </CertificateContext.Provider>
  );
};

export const useCertificate = () => {
  const context = useContext(CertificateContext);
  if (!context)
    throw new Error("useCertificate must be used within CertificateProvider");
  return context;
};