export type Language = 'en' | 'vi';

export const TRANSLATIONS = {
  en: {
    // Header & Navigation (ShowroomHeader.tsx)
    navOutdoor: "Outdoor",
    navBedroom: "Bedroom",
    navIndoorLab: "Indoor Lab",
    navCraftStudio: "Craft Studio",
    nav3D: "3D Interactive",
    nav2D: "2D Campaign Showcase",
    navStudio: "Banner Studio",

    // Bottom Dock & Actions (PuffyFloatingHero3D.tsx)
    explodeLayers: "Explode {count} Layers",
    assembleMattress: "Assemble Mattress",
    cameraAngles: "Camera Angles",
    resetView: "Reset 45° Hero",
    dollyCloseUp: "Dolly Close-Up",
    topDown: "Top-Down View",
    meadowScene: "Dreamy Meadow",
    bedroomScene: "Modern Bedroom",
    cameraAnglesLabel: "Camera Angles",
    explodedView: "Exploded View",
    hero45DefaultReset: "Hero 45° (Default / Reset)",
    pressWoolPad: "Press Wool Pad",
    viewInBedroom: "View in Bedroom (XR)",
    returnToMeadow: "Return to Meadow",
    slideOutLayerLabel: "3D Slide-Out Layer:",

    // Bedroom Configurator (BedroomConfiguratorDock.tsx)
    bedding: "Bedding",
    lighting: "Lights",
    landscape: "Garden",
    walls: "Walls",
    on: "ON",
    off: "OFF",
    setLabel: "Set:",
    mattressLabel: "Mattress:",
    runnerLabel: "Runner:",
    pillowsLabel: "Pillows:",
    explodeBtnTitleAssemble: "Assemble Mattress",
    explodeBtnTitleExplode: "Explode Layers",
    assembleBtnShort: "Assemble",
    explodeBtnShort: "Explode",

    // Craft & Specs Overlay (PuffyFloatingHero3D.tsx and others)
    specsTitle: "Craft & Specs Lab",
    experience10Layers: "Experience 10 Layers of Ultra-Plush Comfort",
    returnToScene: "Return to 3D Scene",
    openInBannerStudio: "Open in Banner Studio ➜",
    firmnessLabel: "Firmness",
    softLabel: "Soft",
    firmLabel: "Firm",

    // Room environment style options (BedroomConfiguratorDock.tsx)
    japandiSanctuary: "Japandi Sanctuary",
    nordicCoastal: "Nordic Coastal",
    midCentury: "Mid-Century",
    urbanLoft: "Urban Loft",
    japandiShort: "Japandi",
    nordicShort: "Nordic",
    midCenturyShort: "Mid-Century",
    urbanLoftShort: "Urban Loft",

    // Configurable Items shortLabels / names
    Runner: "Runner",
    Pillows: "Pillows",
    Pendants: "Pendants",
    "Cloud Light": "Cloud Light",
    "Zen Garden": "Zen Garden",

    // SceneCaptureDock.tsx
    downloadWebP: "Download WebP",
    openInStudio: "Open in Banner Studio",
    closeBtn: "Close",
    recordingCinematic: "Recording Cinematic... {progress}%",
    snapshotTooltip: "Capture Snapshot (.webp)",
    captureStudioSceneTooltip: "Capture two-pass studio scene",

    // PuffyFloatingHero3D.tsx Hints
    introTouchEnter: "Touch to Enter the Dream",
    introSkip: "Skip Intro",
    introScrollHint: "[ 🖱️ Scroll to Drift ]",
    introOrbitHint: "[ 🔄 Drag to Orbit 360° ]",

    // BannerStudio.tsx
    alertNoLogoData: "No brand logo data is available.",
    alertUploadBgFirst: "Please upload or capture a background image first.",
    aiPromptPlaceholder: "Describe the desired AI bedroom scene (lighting, furniture, style)...",
    compositingLogo: "🪄 Compositing logo...",
    applyMattressLogo: "✨ Composite Brand Logo",
    badgeReady: "✓ Captured",
    badgeNotCaptured: "Using default",
    noLogoDataPrompt: "No brand logo data is available.",
    downloadPngLogo: "Download Logo PNG (Transparent)",

    // ShowroomGallery2D.tsx
    galleryAllRenders: "All Renders",
    galleryCampaignBanners: "Campaign Banners",
    galleryLifestylePlacement: "Lifestyle Placement",
    galleryPbrInspection: "MaterialCraft 4K PBR",
  },

  vi: {
    // Header & Navigation (ShowroomHeader.tsx)
    navOutdoor: "Trải Nghiệm 3D",
    navBedroom: "Phòng Ngủ",
    navIndoorLab: "Phòng Thí Nghiệm",
    navCraftStudio: "Xưởng Banner AI",
    nav3D: "Trải Nghiệm 3D",
    nav2D: "Bộ Sưu Tập Banner 2D",
    navStudio: "Xưởng Banner AI",

    // Bottom Dock & Actions (PuffyFloatingHero3D.tsx)
    explodeLayers: "Bóc Tách {count} Lớp",
    assembleMattress: "Thu Gọn Nệm",
    cameraAngles: "Góc Máy Quay",
    resetView: "Góc Mặc Định 45°",
    dollyCloseUp: "Soi Cận Cảnh",
    topDown: "Góc Nhìn Từ Trên",
    meadowScene: "Đồi Cừu Mơ Màng",
    bedroomScene: "Phòng Ngủ Hiện Đại",
    cameraAnglesLabel: "Góc Quay Camera",
    explodedView: "Xem Bóc Tách Lớp",
    hero45DefaultReset: "Góc Mặc Định 45° (Đặt lại)",
    pressWoolPad: "Ấn Nệm Trải Nghiệm",
    viewInBedroom: "Xem trong Phòng Ngủ (XR)",
    returnToMeadow: "Quay lại Đồi Cừu",
    slideOutLayerLabel: "Lớp Cắt 3D:",

    // Bedroom Configurator (BedroomConfiguratorDock.tsx)
    bedding: "Chăn Ga Gối Nệm",
    lighting: "Ánh Sáng",
    landscape: "Sân Vườn",
    walls: "Tường",
    on: "BẬT",
    off: "TẮT",
    setLabel: "Bộ Set:",
    mattressLabel: "Nệm:",
    runnerLabel: "Khăn Trải:",
    pillowsLabel: "Số Lượng Gối:",
    explodeBtnTitleAssemble: "Thu Gọn Nệm",
    explodeBtnTitleExplode: "Bóc Tách Các Lớp",
    assembleBtnShort: "Thu Gọn",
    explodeBtnShort: "Bóc Tách",

    // Craft & Specs Overlay (PuffyFloatingHero3D.tsx and others)
    specsTitle: "Phòng Nghiên Cứu Cấu Trúc Nệm",
    experience10Layers: "Trải Nghiệm 10 Tầng Êm Ái Cao Cấp",
    returnToScene: "Quay Lại Không Gian 3D",
    openInBannerStudio: "Mở trong Banner Studio ➜",
    firmnessLabel: "Độ cứng",
    softLabel: "Êm Ái",
    firmLabel: "Nâng Đỡ",

    // Room environment style options (BedroomConfiguratorDock.tsx)
    japandiSanctuary: "Phòng Japandi Tĩnh Lặng",
    nordicCoastal: "Phòng Bắc Âu Gió Biển",
    midCentury: "Phòng Mid-Century Cổ Điển",
    urbanLoft: "Phòng Gác Mái Đô Thị",
    japandiShort: "Japandi",
    nordicShort: "Bắc Âu",
    midCenturyShort: "Mid-Century",
    urbanLoftShort: "Gác Mái",

    // Configurable Items shortLabels / names
    Runner: "Khăn Trải Nệm",
    Pillows: "Số Lượng Gối",
    Pendants: "Đèn Chùm",
    "Cloud Light": "Đèn Trần Mây",
    "Zen Garden": "Sân Vườn Zen",

    // SceneCaptureDock.tsx
    downloadWebP: "Tải ảnh WebP",
    openInStudio: "Mở trong Banner Studio",
    closeBtn: "Đóng",
    recordingCinematic: "Đang quay Cinematic... {progress}%",
    snapshotTooltip: "Chụp ảnh khoảnh khắc (.webp)",
    captureStudioSceneTooltip: "Chụp ảnh Studio hai bước",

    // PuffyFloatingHero3D.tsx Hints
    introTouchEnter: "Chạm để bước vào giấc mơ",
    introSkip: "Bỏ qua",
    introScrollHint: "[ 🖱️ Cuộn chuột để bay ]",
    introOrbitHint: "[ 🔄 Giữ & Rê chuột để xoay nệm 360° ]",

    // BannerStudio.tsx
    alertNoLogoData: "Không tìm thấy dữ liệu Logo Pass B của góc chụp này.",
    alertUploadBgFirst: "Vui lòng tải ảnh nền hoặc chụp trước.",
    aiPromptPlaceholder: "Mô tả bối cảnh phòng ngủ AI mong muốn (ánh sáng, nội thất, phong cách)...",
    compositingLogo: "🪄 Đang dán logo...",
    applyMattressLogo: "✨ Dán Logo Nệm Gốc",
    badgeReady: "✓ Sẵn Sàng",
    badgeNotCaptured: "Chưa Chụp",
    noLogoDataPrompt: "Chưa có dữ liệu logo. Hãy bấm nút máy ảnh ở 3D Bedroom để trích xuất.",
    downloadPngLogo: "Tải Logo PNG (Nền Trong Suốt)",

    // ShowroomGallery2D.tsx
    galleryAllRenders: "Tất cả bản Renders",
    galleryCampaignBanners: "Banner Chiến Dịch",
    galleryLifestylePlacement: "Bối Cảnh Đời Sống",
    galleryPbrInspection: "Vật Liệu PBR 4K",
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;
