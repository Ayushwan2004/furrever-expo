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

const CertificateContext = createContext<CertificateContextType | undefined>(
  undefined
);

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
            .inner-border { position: relative; z-index: 10; flex: 1; border: 2.5px solid ${colors.primary}; padding: 30px 60px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; background-color: rgba(255, 255, 255, 0.88); }
            .logo { font-size: 45pt; font-weight: 900; color: ${colors.primary}; letter-spacing: -1.5px; line-height: 1; }
            .pet-photo { width: 140px; height: 140px; border-radius: 50%; object-fit: cover; border: 5px solid ${colors.primary}; box-shadow: 0 10px 20px rgba(0,0,0,0.1); margin: 15px 0; }
            .name-highlight { font-size: 28pt; font-weight: 800; color: #222; border-bottom: 2pt solid ${colors.primary}35; display: inline-block; padding: 0 45px; margin-bottom: 12px; }
            .footer { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 15px; }
            .seal { width: 105px; height: 105px; border: 3.5px double ${colors.primary}; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: ${colors.primary}; transform: rotate(-15deg); background-color: #fff; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="outer-border">
              <div class="watermark-container"><div class="main-watermark">FURREVER VERIFIED</div></div>
              <div class="inner-border">
                <div><h1 class="logo">FurrEver</h1><p style="text-transform: uppercase; letter-spacing: 8px; font-size: 13pt; color: #666;">Certificate of Adoption</p></div>
                <img src="${cert.petImage}" class="pet-photo" />
                <div>
                  <p style="font-size: 14pt; color: #777; font-style: italic;">This officially certifies that</p>
                  <div class="name-highlight">${cert.adopterName}</div>
                  <p style="font-size: 14pt; color: #777; font-style: italic;">has provided a loving forever home to</p>
                  <div class="name-highlight" style="color: ${colors.primary};">${cert.petName}</div>
                  <p style="font-size: 15pt; color: #333; margin-top: 10px;">A beautiful <b>${cert.breed}</b> ${cert.category}</p>
                  <p style="font-size: 11pt; color: #888; margin-top: 15px;">Witnessed and validated on: <b>${date}</b></p>
                </div>
                <div class="footer">
                  <div style="text-align: left;">
                    <p style="font-family: monospace; font-size: 10pt; color: #aaa; font-weight: bold;">${cert.serialCode}</p>
                    <p style="color: ${colors.primary}; font-weight: 900; font-size: 12pt; letter-spacing: 2px;">OFFICIAL RECORD</p>
                    <p style="color: ${colors.textLight}; font-weight: 900; font-size: 8pt; letter-spacing: 2px;">Secured & Verified-FurrEver</p>
                  </div>
                  <div class="seal"><span style="font-size: 30pt;">🐾</span><span style="font-size: 9pt; font-weight: 900;">FurrEver</span></div>
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