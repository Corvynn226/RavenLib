import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface SeedPdfBookSpec {
  filename: string;
  title: string;
  author: string;
  category: string;
  year: number;
  isbn: string;
  chapters: Array<{
    heading: string;
    paragraphs: string[];
  }>;
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxCharsPerLine) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateSeedPdfIfMissing(
  uploadsDir: string,
  spec: SeedPdfBookSpec
): Promise<number> {
  const filePath = path.join(uploadsDir, spec.filename);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    return stat.size;
  }

  const pdfDoc = await PDFDocument.create();
  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const serifRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const sansRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const ink = rgb(0.11, 0.1, 0.09);
  const muted = rgb(0.38, 0.35, 0.32);
  const lapis = rgb(0.12, 0.23, 0.54);
  const hairline = rgb(0.84, 0.81, 0.76);

  // Page 1: Title / Cover Sheet
  const titlePage = pdfDoc.addPage([pageWidth, pageHeight]);
  titlePage.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(0.985, 0.976, 0.96),
  });
  titlePage.drawRectangle({
    x: 48,
    y: 48,
    width: pageWidth - 96,
    height: pageHeight - 96,
    borderColor: hairline,
    borderWidth: 1,
  });

  titlePage.drawText('PUSTAKA AKSARA  |  EDISI DIGITAL', {
    x: 72,
    y: pageHeight - 108,
    size: 10,
    font: sansRegular,
    color: lapis,
  });

  const titleLines = wrapText(spec.title, 34);
  let titleY = pageHeight - 210;
  for (const line of titleLines) {
    titlePage.drawText(line, {
      x: 72,
      y: titleY,
      size: 26,
      font: serifBold,
      color: ink,
    });
    titleY -= 36;
  }

  titlePage.drawLine({
    start: { x: 72, y: titleY - 10 },
    end: { x: 240, y: titleY - 10 },
    thickness: 1.5,
    color: lapis,
  });

  titlePage.drawText(`Penulis: ${spec.author}`, {
    x: 72,
    y: titleY - 44,
    size: 13,
    font: serifRegular,
    color: ink,
  });

  titlePage.drawText(`Kategori: ${spec.category}  |  Tahun Terbit: ${spec.year}`, {
    x: 72,
    y: titleY - 68,
    size: 10.5,
    font: sansRegular,
    color: muted,
  });

  titlePage.drawText(`ISBN ${spec.isbn}`, {
    x: 72,
    y: 96,
    size: 10,
    font: sansRegular,
    color: muted,
  });

  // Page 2: Table of Contents
  const tocPage = pdfDoc.addPage([pageWidth, pageHeight]);
  tocPage.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(0.995, 0.992, 0.985),
  });
  tocPage.drawText('DAFTAR ISI', {
    x: 72,
    y: pageHeight - 96,
    size: 16,
    font: serifBold,
    color: ink,
  });
  tocPage.drawLine({
    start: { x: 72, y: pageHeight - 110 },
    end: { x: pageWidth - 72, y: pageHeight - 110 },
    thickness: 0.75,
    color: hairline,
  });

  let tocY = pageHeight - 148;
  spec.chapters.forEach((chapter, idx) => {
    tocPage.drawText(`0${idx + 1}.  ${chapter.heading}`, {
      x: 72,
      y: tocY,
      size: 12,
      font: serifRegular,
      color: ink,
    });
    tocPage.drawText(`Halaman ${idx + 3}`, {
      x: pageWidth - 140,
      y: tocY,
      size: 10,
      font: sansRegular,
      color: muted,
    });
    tocY -= 32;
  });

  tocPage.drawText(
    'Dokumen ini disediakan oleh Pustaka Aksara untuk bacaan daring anggota perpustakaan.',
    {
      x: 72,
      y: 78,
      size: 9.5,
      font: sansRegular,
      color: muted,
    }
  );

  // Chapter Pages
  spec.chapters.forEach((chapter, idx) => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(0.996, 0.994, 0.99),
    });

    page.drawText(`${spec.title.slice(0, 48)}`, {
      x: 72,
      y: pageHeight - 54,
      size: 8.5,
      font: sansRegular,
      color: muted,
    });

    page.drawText(`BAB ${idx + 1}`, {
      x: 72,
      y: pageHeight - 102,
      size: 10,
      font: sansRegular,
      color: lapis,
    });

    const headLines = wrapText(chapter.heading, 42);
    let cursorY = pageHeight - 128;
    for (const hl of headLines) {
      page.drawText(hl, {
        x: 72,
        y: cursorY,
        size: 19,
        font: serifBold,
        color: ink,
      });
      cursorY -= 26;
    }

    page.drawLine({
      start: { x: 72, y: cursorY - 4 },
      end: { x: pageWidth - 72, y: cursorY - 4 },
      thickness: 0.75,
      color: hairline,
    });
    cursorY -= 32;

    for (const para of chapter.paragraphs) {
      const lines = wrapText(para, 74);
      for (const line of lines) {
        if (cursorY < 88) break;
        page.drawText(line, {
          x: 72,
          y: cursorY,
          size: 11.5,
          font: serifRegular,
          color: ink,
        });
        cursorY -= 19;
      }
      cursorY -= 12;
    }

    page.drawText(`Halaman ${idx + 3} dari ${spec.chapters.length + 2}`, {
      x: pageWidth / 2 - 42,
      y: 44,
      size: 9,
      font: sansRegular,
      color: muted,
    });
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);
  return pdfBytes.length;
}

export const SEED_BOOK_SPECS: Array<
  SeedPdfBookSpec & {
    id: string;
    pages: number;
    language: string;
    description: string;
    coverUrl: string;
    totalCopies: number;
    availableCopies: number;
  }
> = [
  {
    id: 'book-arsitektur-nusantara',
    filename: 'arsitektur-kayu-nusantara.pdf',
    title: 'Arsitektur Kayu Nusantara: Konstruksi Pendopo & Sambungan Tradisional',
    author: 'Prof. Hendra Wijaya',
    category: 'Arsitektur',
    year: 2024,
    isbn: '978-602-441-108-2',
    pages: 342,
    language: 'Indonesia',
    description:
      'Kajian menyeluruh mengenai sistem struktur kayu jati pada pendopo Jawa, teknik sambungan pasak tanpa paku logam, serta adaptasi iklim tropis lembap.',
    coverUrl: '/src/assets/images/cover_arsitektur_nusantara_1795676566346.jpg',
    totalCopies: 3,
    availableCopies: 3,
    chapters: [
      {
        heading: 'Prinsip Struktur Rangka & Keseimbangan Gravitasi',
        paragraphs: [
          'Arsitektur kayu tradisional di kepulauan Nusantara bertumpu pada pemahaman mendalam terhadap sifat elastisitas serat kayu keras tropis. Berbeda dengan konstruksi batu yang kaku, sistem rangka tiang dan balok bekerja melalui distribusi beban dinamis yang mampu meredam getaran seismik.',
          'Pada struktur pendopo Jawa, empat tiang utama atau soko guru menopang tumpang sari di bagian tengah atap. Sambungan purus dan lubang dibuat dengan toleransi presisi sehingga kayu dapat memuai dan menyusut mengikuti pergantian musim hujan dan kemarau tanpa merusak keutuhan bidang atap.',
          'Penelitian lapangan di berbagai kabupaten menunjukkan bahwa pengeringan alami kayu selama minimal tiga tahun sebelum pemahatan merupakan kunci umur panjang bangunan hingga lebih dari dua abad.',
        ],
      },
      {
        heading: 'Tipologi Sambungan Pasak Tanpa Paku Logam',
        paragraphs: [
          'Penggunaan pasak kayu keras atau paku bambu bukan sekadar pilihan estetika, melainkan strategi mekanika struktural. Ketika gempa terjadi, sambungan pasak memungkinkan pergeseran mikro yang melepaskan energi kinetik secara bertahap.',
          'Setiap jenis sambungan memiliki nama dan fungsi khusus, seperti sambungan bibir miring berkait untuk balok tarik, serta sambungan ekor burung pada sudut pengaku dinding papan. Penguasaan teknik ini diwariskan melalui lisan dan praktik langsung di bengkel tukang kayu.',
        ],
      },
      {
        heading: 'Tata Cahaya, Sirkulasi Udara, dan Ruang Sosial',
        paragraphs: [
          'Ruang terbuka di bawah naungan atap joglo dirancang untuk memperlambat laju radiasi panas matahari sekaligus mengalirkan angin silang dari pelataran menuju ruang dalam. Ketinggian atap yang berjenjang menciptakan efek cerobong alami.',
          'Selain fungsi termal, proporsi ruang pendopo mencerminkan tata krama pertemuan warga, tempat dialog terbuka berlangsung dalam suasana teduh dan setara.',
        ],
      },
    ],
  },
  {
    id: 'book-ekologi-maritim',
    filename: 'ekologi-maritim-kepulauan.pdf',
    title: 'Ekologi Maritim Kepulauan: Arus Laut, Terumbu, dan Pengetahuan Pesisir',
    author: 'Dr. Ratna Kusuma',
    category: 'Sains & Alam',
    year: 2025,
    isbn: '978-602-441-214-0',
    pages: 288,
    language: 'Indonesia',
    description:
      'Telaah ekologi kelautan Indonesia yang memadukan oseanografi arus lintas Indonesia dengan kearifan nelayan tradisional dalam menjaga ekosistem terumbu karang.',
    coverUrl: '/src/assets/images/cover_ekologi_maritim_1795676566188.jpg',
    totalCopies: 3,
    availableCopies: 2,
    chapters: [
      {
        heading: 'Dinamika Arus Lintas Indonesia dan Kesuburan Plankton',
        paragraphs: [
          'Perairan Nusantara menjadi koridor pertukaran massa air terbesar antara Samudra Pasifik dan Samudra Hindia. Arus Lintas Indonesia atau Arlindo membawa massa air hangat kaya nutrien yang menghidupi rantai makanan pelagis di sepanjang selat Makassar dan Laut Banda.',
          'Perubahan suhu permukaan laut akibat siklus muson tenggara dan muson barat laut memicu fenomena upwelling di selatan Jawa serta perairan Maluku, meningkatkan produktivitas fitoplankton secara berkala.',
        ],
      },
      {
        heading: 'Padang Lamun dan Hutan Bakau sebagai Penyangga Pesisir',
        paragraphs: [
          'Ekosistem lamun yang kerap luput dari perhatian justru berperan sebagai penyerap karbon biru yang sangat efisien sekaligus tempat asuhan bagi puluhan spesies ikan karang bernilai ekonomis.',
          'Keterhubungan antara hutan bakau, padang lamun, dan terumbu karang membentuk sabuk pertahanan biologis yang melindungi garis pantai dari abrasi gelombang tinggi.',
        ],
      },
      {
        heading: 'Sistem Sasi Laut dan Tata Kelola Berbasis Komunitas',
        paragraphs: [
          'Di banyak desa pesisir Indonesia timur, larangan panen musiman atau sasi laut terbukti memulihkan biomassa teripang, lola, dan ikan karang secara konsisten. Pengawasan dilakukan bersama oleh tetua adat dan generasi muda kampung.',
          'Integrasi data pemantauan satelit dengan kalender pasang surut tradisional membuka jalan bagi kebijakan konservasi maritim yang adil dan tahan lama.',
        ],
      },
    ],
  },
  {
    id: 'book-filsafat-teknologi',
    filename: 'filsafat-teknologi-ruang-publik.pdf',
    title: 'Filsafat Teknologi & Nalar Algoritmik di Ruang Publik',
    author: 'Bagus Santoso, M.Hum.',
    category: 'Filsafat',
    year: 2024,
    isbn: '978-602-441-305-5',
    pages: 216,
    language: 'Indonesia',
    description:
      'Refleksi kritis mengenai bagaimana sistem peringkat otomatis, infrastruktur digital, dan arsitektur informasi membentuk cara warga berpikir serta mengambil keputusan bersama.',
    coverUrl: '/src/assets/images/cover_filsafat_teknologi_1795676566379.jpg',
    totalCopies: 2,
    availableCopies: 2,
    chapters: [
      {
        heading: 'Dari Perkakas ke Infrastruktur Kognitif',
        paragraphs: [
          'Sepanjang sejarah filsafat teknik, perkakas dipahami sebagai perpanjangan tangan manusia. Namun sistem komputasi modern tidak lagi berhenti pada fungsi alat bantu fisik; ia menata ulang perhatian, ingatan kolektif, dan batas hal yang dianggap relevan.',
          'Ketika algoritma penyortiran menentukan berita atau buku apa yang muncul paling atas, keputusan teknis tersebut diam-diam memikul bobot etis dan politis.',
        ],
      },
      {
        heading: 'Transparansi dan Hak Warga atas Penjelasan',
        paragraphs: [
          'Kepercayaan publik terhadap layanan digital menuntut keterbukaan mekanisme keputusan. Warga perlu memahami alasan di balik rekomendasi, penilaian kelayakan, maupun pembatasan akses.',
          'Perpustakaan digital publik menjadi penyeimbang penting karena mengkurasi pengetahuan berdasarkan mutu intelektual dan keberlanjutan arsip, bukan semata metrik keterlibatan sesaat.',
        ],
      },
      {
        heading: 'Etika Perhatian dan Keheningan Membaca',
        paragraphs: [
          'Membaca buku panjang adalah latihan kesabaran epistemik. Ruang baca digital yang baik semestinya melindungi konsentrasi pembaca dari gangguan notifikasi yang tidak perlu dan memberi tempat bagi perenungan mendalam.',
        ],
      },
    ],
  },
  {
    id: 'book-sejarah-rempah',
    filename: 'jejak-rempah-banda-maluku.pdf',
    title: 'Jejak Rempah Banda & Maluku: Arsip Botani Abad XVII–XIX',
    author: 'Siti Aminah, Ph.D.',
    category: 'Sejarah',
    year: 2023,
    isbn: '978-602-441-089-4',
    pages: 412,
    language: 'Indonesia',
    description:
      'Rekonstruksi sejarah perdagangan pala dan cengkeh melalui manuskrip botani, peta pelayaran pelabuhan rempah, serta catatan keseharian masyarakat kepulauan.',
    coverUrl: '/src/assets/images/cover_sejarah_rempah_1795676566548.jpg',
    totalCopies: 2,
    availableCopies: 1,
    chapters: [
      {
        heading: 'Pala Banda dan Jaringan Pelayaran Samudra Hindia',
        paragraphs: [
          'Jauh sebelum kedatangan armada dagang Eropa, buah pala dari kepulauan vulkanik Banda dan cengkeh dari Ternate serta Tidore telah melintasi jalur laut menuju Malaka, Gujarat, hingga pelabuhan Laut Merah.',
          'Para nakhoda Nusantara membaca rasi bintang, arah angin musim, serta warna arus perairan dangkal untuk menavigasi gugusan atol dan selat sempit di Indonesia timur.',
        ],
      },
      {
        heading: 'Ilustrasi Botani dan Pengetahuan Medis Klasik',
        paragraphs: [
          'Manuskrip botani abad ketujuh belas mencatat dengan cermat bentuk daun, struktur biji pala, serta minyak atsiri cengkeh yang digunakan sebagai pengawet pangan sekaligus ramuan pengobatan.',
          'Di balik nama ilmiah yang dicatat para naturalis, tersimpan kerja sama erat dengan tabib lokal yang mengenali musim berbunga dan khasiat tiap bagian tanaman.',
        ],
      },
      {
        heading: 'Merawat Arsip Maritim untuk Generasi Mendatang',
        paragraphs: [
          'Digitalisasi arsip rempah bukan sekadar memindai lembaran tua, melainkan membuka kembali ruang dialog sejarah yang inklusif agar peneliti, mahasiswa, dan masyarakat umum dapat mengakses sumber primer dengan mudah.',
        ],
      },
    ],
  },
];
