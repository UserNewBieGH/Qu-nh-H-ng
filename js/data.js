/**
 * Data Model for Cô Tư Saigon Street Food Alley Tour
 * Cô Tư Hẻm Explorer - Dữ liệu trạm ẩm thực, đánh giá, đơn hàng, AI prompts
 */

window.CO_TU_DATA = {
  // Thông tin tour chính
  tourInfo: {
    title: "Cô Tư Hẻm Explorer - Tour Ẩm Thực & AI Hướng Dẫn Viên",
    subTitle: "Chuyến Luồn Hẻm Ẩm Thực Về Đêm: Sài Gòn Hẻm Khuya & Vị Ký Ức",
    pricePerAdult: 590000,
    pricePerChild: 350000,
    durationHours: 4,
    startTime: "16:30",
    endTime: "20:30",
    maxGroupSize: 8,
    meetingPoint: "Hẻm 150 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP.HCM",
    hotline: "0908 287 150",
    zaloNumber: "0908287150",
    email: "lienhe@cotu-saigon.vn"
  },

  // 5 Trạm ẩm thực độc quyền hẻm sâu
  stops: [
    {
      id: 1,
      name: "Bánh Cuốn Hẻm Cổ Đa Kao",
      time: "16:30",
      duration: "40 Phút",
      district: "Quận 1",
      address: "Hẻm 150 Nguyễn Đình Chiểu, P. Đa Kao, Q.1",
      tag: "Bếp củi 3 đời",
      badgeColor: "secondary",
      flavor: "Thanh tao, béo bùi",
      flavorType: "thanh",
      dietary: ["an_chay", "khong_noi_tang"],
      spicyLevel: 1,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBnw7hb-viRs57Z78r3TWbF5aJ4Nc3Ee27z4YeRCnBgYzXJLsrWbFtEs0VQ-yci6TSdSdJ0r5-MylAdV2ebZmsZgNwFyB-YzK7oVY8zqQ5cWKcaMqU4UeVgc4AJUC-OyweUlU09LPK_9DrtH9-GYplqTQ81oWVIQ52IOjauyGzwY865irAWrILt1XOZbGuwBYdiieFB-uD5wvfxhz8sgZ4Q6VbMrUZBrVr0tyOGp9g",
      description: "Lớp bánh mỏng tang tráng bằng nồi hơi truyền thống trên bếp than đượm, nhân mộc nhĩ thịt băm nấm hương thơm lừng chấm cùng nước mắm ớt pha tỏi cổ truyền dịu ngọt.",
      secretTip: "Hãy xin thêm một muỗng hành phi giòn rụm tự làm mỗi sáng và một miếng chả lụa quết thủ công!",
      audioTitle: "Tiếng Nồi Hơi & Chuyện Xóm Bánh Đa Kao",
      audioDuration: "2:45"
    },
    {
      id: 2,
      name: "Cà Phê Vợt 70 Năm Chú Ba",
      time: "17:20",
      duration: "35 Phút",
      district: "Phú Nhuận",
      address: "Hẻm 330 Phan Đình Phùng, P.1, Q. Phú Nhuận",
      tag: "Lò than đượm khói",
      badgeColor: "tertiary",
      flavor: "Đắng đậm, béo sữa",
      flavorType: "dam_da",
      dietary: ["an_chay", "khong_noi_tang", "khong_hanh"],
      spicyLevel: 0,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBWe0R-8r2ACbhQ_iYSZ1ZAQ0ZuBu495X3kOO9iJnjVbR9lCQtgT9gVLw7RbyAMuUcbdPpDhr5TDW020ExjaYzgpRh4B021S_vR3jJDCUE6ESMDhnkYCRQwfdGBnx0YovWKdn_prc_sQNYp1nDbzFQAHUwsFRErNGXS3BniBJQGXgsONG1ogMXVRTA4rjLu469z9RqTsFq0eCMN6vv7ZxnNOxDA-3hjaNNCk05uJcI",
      description: "Nghe tiếng nước sôi sùng sục trong siêu đất nung, thưởng thức ly bạc xỉu nóng hổi hoặc cà phê sữa đậm đặc, đậm chất phong thái Chợ Lớn xưa cũ không bao giờ tắt lửa.",
      secretTip: "Nhấp một ngụm rồi thổi bớt khói, chấm kèm bánh tiêu chiên giòn rụm vừa vớt ra khỏi chảo dầu vàng ruộm.",
      audioTitle: "Bí Mật Của Chiếc Vợt Bít-Tất Ba Đời",
      audioDuration: "3:10"
    },
    {
      id: 3,
      name: "Hủ Tiếu Hồ Triều Châu",
      time: "18:10",
      duration: "45 Phút",
      district: "Quận 5",
      address: "Hẻm Gò Cống, P.13, Q.5 (Khu Chợ Lớn)",
      tag: "Đặc sản hiếm có",
      badgeColor: "secondary",
      flavor: "Thảo mộc thanh ngọt",
      flavorType: "thanh",
      dietary: ["co_noi_tang"],
      spicyLevel: 2,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCdDsnMjgyJYjj7t1qPJX1wW7ysTo4wY5TlHl-nRzmFVKiDWM6vOlvO_NZtBk-nfiit10f63Drp7CkLXvHPC4r48-fHEaYyKVaYCUDckKJbj9IcjAwMPee9Se7pqxbr6dWR1UeupeANb24ds4X1OdE4--mVcNmvP-I46A7lu3oOdEBfo0sJ-mkfPIdcHSoC3J-RSQBrT9OQ22DPrkHs1R9_YubD4IzsK6NlW5e9hfM",
      description: "Bánh hủ tiếu bản to như miếng hoành thánh mềm mướt, nước súp ngâm thảo mộc thuốc bắc thanh ngọt kết hợp lòng heo khìa giòn sần sật và cải chua thanh tao khử ngấy.",
      secretTip: "Trộn đều muỗng sa tế tôm Chợ Lớn gia truyền nếu ăn được cay, cắn kèm cọng cải chua giòn tan.",
      audioTitle: "Nguồn Gốc Món Hủ Tiếu Hồ Của Người Tiều",
      audioDuration: "3:40"
    },
    {
      id: 4,
      name: "Phá Lấu Bò Dì Bảy Nước Cốt Dừa",
      time: "19:15",
      duration: "40 Phút",
      district: "Quận 4",
      address: "Hẻm 200 Tôn Đản, P.8, Q.4",
      tag: "Béo ngậy thơm nức",
      badgeColor: "primary",
      flavor: "Béo ngậy, cay nồng",
      flavorType: "cay_nong",
      dietary: ["co_noi_tang"],
      spicyLevel: 3,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAHL93XRoFEL2g6kWWrItIYhslJ8UGjm0bTo4wlRghJjV2TUi2mY95cacLBXo2NzDF9exQoya03oBtZkYeChzYnm96XzHRk1VjWGE7lWZuYEVImQDLSmnv_QR0_cad5aNnyw4RZofadkAp19wmOQdAQNac3w3lzM6RAv3pAeXpqMO_oXMOb0A6tfGVAYsEcFcy46EIPgjyzEd83K5nZ4K-pI5htNxgMqv_4dekEtFg",
      description: "Nồi phá lấu sôi lục bục với màu vàng óng của nghệ tươi và béo bùi từ nước dừa nguyên chất, chấm bánh mì nướng giòn rụm cùng nước mắm tắc chua cay xé lưỡi.",
      secretTip: "Dùng que xiên từng miếng lá xách, tổ ong rồi nhúng ngập vào chén mắm tắc ớt hiểm!",
      audioTitle: "Hẻm Tôn Đản & Nồi Phá Lấu Đỏ Lửa Đêm",
      audioDuration: "2:55"
    },
    {
      id: 5,
      name: "Tráng Miệng Chè Mâm 16 Món",
      time: "20:00",
      duration: "30 Phút",
      district: "Quận 10",
      address: "Hẻm 242 Sư Vạn Hạnh, P.2, Q.10",
      tag: "Vị ngọt thanh Nam Bộ",
      badgeColor: "tertiary",
      flavor: "Ngọt thanh, mát lành",
      flavorType: "ngot_diu",
      dietary: ["an_chay", "khong_noi_tang", "khong_hanh"],
      spicyLevel: 0,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCKc21O0PhLuJ6AinO9OiowAmWJsiyCYa84_yKqZpDvLzR2mdO8hsXpQkFq-5W9BX5kwdcTb_3bWwthmAOvghJg20Z2A4KpLk9tZu4wEs0Bb4RXHXRn5ZEtMAC-_vn-fLKNT2fT_fpRg2pGNFsndsmvePszl2BJGFUBcAnIwrN_rQuGLG-SZaBtyZQCHJhiCP5ILpW1w5ArWL8FSRSFAkMFK6nL0tMrW5t9yY1lMF4",
      description: "Khép lại đêm ngõ nhỏ bằng mâm chè truyền thống Nam Bộ: Chè bà ba, chè trôi nước đường thốt nốt, chè đậu trắng béo cốt dừa, vừa ăn vừa ngắm phố đêm lắng dịu.",
      secretTip: "Thử viên chè trôi nước nhân đậu xanh thơm gừng ấm bụng trước, rồi mới tới chè đậu cốt dừa.",
      audioTitle: "16 Vị Ngọt Lành Sưởi Ấm Đêm Sài Gòn",
      audioDuration: "2:30"
    }
  ],

  // Bảng so sánh chi phí minh bạch
  costBreakdown: [
    { item: "5 Phần ăn & uống tươi nóng nguyên bản", amount: 280000, note: "Bao no nê, không ăn đồ hâm lại", icon: "restaurant" },
    { item: "Thù lao Hướng dẫn viên bản xứ hẻm sâu", amount: 160000, note: "Thuyết minh văn hóa, bảo hộ an toàn", icon: "badge" },
    { item: "Bảo hiểm du lịch & vệ sinh thực phẩm", amount: 50000, note: "Bảo hiểm mức bồi thường 100.000.000đ", icon: "health_and_safety" },
    { item: "Bộ Kit ngõ hẻm (khăn lạnh, nón, áo mưa, tai nghe)", amount: 40000, note: "Trang bị chu đáo khi di chuyển ngõ nhỏ", icon: "backpack" },
    { item: "Quỹ bảo tồn văn hóa & hỗ trợ gánh hàng rong", amount: 60000, note: "Trích trực tiếp hỗ trợ các dì các bà gánh hàng", icon: "volunteer_activism" }
  ],

  // Bảng so sánh 3 gói
  comparisonPackages: [
    {
      id: "ota",
      title: "Tour Đại Trà OTA",
      subTitle: "Các nền tảng du lịch công nghiệp",
      price: "950.000₫+",
      unit: "/khách",
      isFeatured: false,
      badge: "Đắt & Đại trà",
      features: [
        { text: "Quán mặt tiền liên kết ăn chia hoa hồng", pass: false },
        { text: "Đoàn đông từ 15 - 25 người ồn ào", pass: false },
        { text: "Không có hướng dẫn viên AI cá nhân hóa", pass: false },
        { text: "Giới hạn khẩu phần, phát sinh tiền nước uống", pass: false },
        { text: "Lịch trình vội vã chạy theo KPI đối tác", pass: false }
      ],
      ctaText: "Không nên chọn",
      disabled: true
    },
    {
      id: "cotu",
      title: "Cô Tư Hẻm Odyssey",
      subTitle: "Chuyến luồn hẻm chuẩn vị gia truyền",
      price: "590.000₫",
      unit: "/khách",
      isFeatured: true,
      badge: "Được Khuyên Dùng Nhất",
      features: [
        { text: "5 trạm hẻm sâu gia truyền trên 30 năm tuổi", pass: true },
        { text: "Nhóm nhỏ ấm cúng tối đa 8 khách", pass: true },
        { text: "AI Cô Tư tư vấn khẩu vị & dị ứng riêng", pass: true },
        { text: "Bao trọn 100% tất cả món ăn & đồ uống", pass: true },
        { text: "Bảo hiểm trọn gói & cam kết hoàn tiền 100%", pass: true }
      ],
      ctaText: "Đặt Chỗ Với Cô Tư Ngay",
      disabled: false
    },
    {
      id: "self",
      title: "Tự Đi Phượt Hẻm",
      subTitle: "Đi tự túc theo review mạng xã hội",
      price: "~400.000₫",
      unit: "/khách",
      isFeatured: false,
      badge: "Rủi ro lạc đường",
      features: [
        { text: "Dễ lạc trong ma trận ngõ cụt 3 xẹc", pass: false },
        { text: "Đến nơi quán đóng cửa hoặc hết món sớm", pass: false },
        { text: "Dễ bị bẫy giá quán bán cho khách vãng lai", pass: false },
        { text: "Không người kể chuyện văn hóa ẩm thực", pass: false },
        { text: "Tự lo an toàn giao thông & vệ sinh", pass: false }
      ],
      ctaText: "Nhiều Rủi Ro",
      disabled: true
    }
  ],

  // Đơn hàng mẫu ban đầu
  initialOrders: [
    { id: "CT-8291", name: "Trần Minh Quân", phone: "0912 345 678", email: "quan.tran@gmail.com", date: "Hôm nay 16:30", guests: 2, adults: 2, children: 0, total: "1.180.000₫", discount: "0₫", payment: "VIETQR", status: "Đã xác nhận", dietary: "Không ăn cay, Dị ứng tôm", notes: "1 bạn dị ứng tôm", createdAt: "2026-11-06T10:30:00.000Z" },
    { id: "CT-8304", name: "Nguyễn Hải Yến", phone: "0988 776 554", email: "haiyen.ng@outlook.com", date: "Ngày mai 16:30", guests: 4, adults: 3, children: 1, total: "2.070.000₫", discount: "50.000₫ (TIKTOK50)", payment: "MOMO", status: "Chờ gặp", dietary: "Ăn được tất cả", notes: "Cho ngồi gần bếp củi xem tráng bánh", createdAt: "2026-11-06T14:20:00.000Z" },
    { id: "CT-8319", name: "David Anderson", phone: "0903 112 233", email: "david.uk@expats.com", date: "28/11/2026 16:30", guests: 2, adults: 2, children: 0, total: "1.180.000₫", discount: "0₫", payment: "CASH", status: "Đã xác nhận", dietary: "Không cay", notes: "English speaking guide requested", createdAt: "2026-11-05T18:00:00.000Z" },
    { id: "CT-8342", name: "Lê Hoàng Kim", phone: "0934 987 654", email: "kimle.art@gmail.com", date: "29/11/2026 16:30", guests: 3, adults: 3, children: 0, total: "1.670.000₫", discount: "100.000₫ (COTU2026)", payment: "VISA", status: "Đã hoàn thành", dietary: "Không nội tạng", notes: "Đi tour chụp ảnh nghệ thuật", createdAt: "2026-11-04T09:15:00.000Z" }
  ],

  // Mã giảm giá hợp lệ
  promoCodes: {
    "TIKTOK50": { discount: 50000, type: "fixed", label: "Ưu đãi TikToker: Giảm 50.000₫" },
    "HEMSAIGON": { discount: 0.1, type: "percent", label: "Vị Hẻm Sài Gòn: Giảm 10% tổng đơn" },
    "COTU2026": { discount: 100000, type: "fixed", label: "Tri ân Cô Tư: Giảm 100.000₫ cho nhóm từ 2 khách" }
  },

  // Câu hỏi thường gặp FAQ
  faqs: [
    {
      q: "Trời mưa Sài Gòn bất chợt thì tour có đi được không?",
      a: "Dạ đi ngon lành luôn con! Mưa Sài Gòn mau tạnh, các con hẻm Cô Tư chọn đều có mái hiên che cổ kính. Cô Tư đã chuẩn bị sẵn áo mưa trong suốt và ô che cho từng bạn. Ngồi húp tô hủ tiếu hồ bốc khói ngắm mưa rơi ngoài ngõ hẻm là trải nghiệm lãng mạn số một luôn!"
    },
    {
      q: "Tôi ăn chay trường hoặc ăn kiêng có tham gia được không?",
      a: "Được chứ con! Bánh cuốn Đa Kao có phiên bản chay nhân mộc nhĩ nấm hương rau củ nước chấm tương chay; cà phê vợt sữa yến mạch/sữa dừa; chè mâm thuần chay 100%. Riêng trạm phá lấu và hủ tiếu hồ Cô Tư sẽ đổi qua món đậu hũ chiên sả nghệ và nấm đùi gà khìa nước dừa thơm lừng."
    },
    {
      q: "Nếu tôi có việc bận đột xuất muốn đổi ngày hoặc hủy thì sao?",
      a: "Cô Tư rất linh hoạt! Chỉ cần con nhắn tin qua Zalo trước giờ xuất phát 4 tiếng, Cô Tư sẽ chuyển ngày miễn phí 100%. Nếu hủy tour trước 24 giờ, Cô Tư hoàn lại 100% tiền cọc không tính phí phát sinh."
    },
    {
      q: "Trẻ em và người lớn tuổi đi bộ nhiều có mệt không?",
      a: "Tổng quãng đường đi bộ luồn hẻm chỉ khoảng 1.5km chia đều cho 4 tiếng đồng hồ (mỗi chặng chỉ đi 5-7 phút là tới quán ngồi nghỉ ngơi 35-45 phút). Cô Tư luôn ưu tiên chọn chỗ ngồi thoáng mát, ghế dựa sạch sẽ cho các cô chú lớn tuổi."
    }
  ],

  // Đánh giá thực khách
  reviews: [
    {
      id: 1,
      author: "Nguyễn Hải Yến",
      type: "couple",
      role: "Khách đi cùng người yêu",
      stars: 5,
      foodScore: 5.0,
      hygieneScore: 5.0,
      guideScore: 5.0,
      date: "Hôm qua",
      likes: 24,
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuChAvXrToEjMONmTr_mxP3dzAnf4mjUD34Me7ZCa1fr-mmRrjss2DJ6WeXH0aOoz5NSc1o075ixZpSaQN76i1oG2GX5sxB3fSRzgKocGSspsbK_2qXhb8PQ1woidFaihBbsPAZ-0PMqvbFPxB265CrgT8FvT5y3Jug9DvvTquSUHJ3BWs8hY3hEQ3CxlNzDW4Xhv5ZiavAGEYYicFlEyAu5PAUdHEbGKNejYgG9RVk",
      content: "Đi tour của Cô Tư xong mới thấy 4 năm đại học ở Sài Gòn mình bỏ lỡ quá nhiều! Quán cà phê vợt Chú Ba thơm phức mùi khói than, ly bạc xỉu ngọt dịu nhấp ngụm nào ấm lòng ngụm đó. Cô Tư chỉ đường tận tình, chụp ảnh cho hai đứa siêu có tâm!"
    },
    {
      id: 2,
      author: "Trần Minh Quân & Nhóm Bạn",
      type: "group",
      role: "Nhóm bạn 4 người",
      stars: 5,
      foodScore: 4.9,
      hygieneScore: 4.8,
      guideScore: 5.0,
      date: "3 ngày trước",
      likes: 18,
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBp-PrfW-MxZKoLiUdmOJf331fh1VtST9EMl1Wi0JsHeWLQX2R7A2VUbIhuAClD_DjTMEiZgZw-LiF5gGwmiYBY3PyHu97EW0-DwcHbVr0n2l6y3nKQF_JEK7pHkDyxECSriIrwZKbqbFJmbCl7JO_2qHv9QJmSUM9rtZmpqT2alMk782RIpoDjh-GTX8QhH9aXVZqV7TADjhzBwgXhRbX363P_M9BhZfgtIq_wZao",
      content: "Ăn no căng bụng thực sự luôn! Nồi phá lấu dì Bảy nước cốt dừa chấm bánh mì nóng giòn ăn dính dã man. Cả nhóm 4 đứa mà đứa nào cũng khen nước dùng hủ tiếu hồ thanh ngọt vị thuốc bắc. Đáng từng xu 590k!"
    },
    {
      id: 3,
      author: "Liam & Sarah (Australia)",
      type: "foreigner",
      role: "Du khách quốc tế",
      stars: 5,
      foodScore: 5.0,
      hygieneScore: 4.9,
      guideScore: 5.0,
      date: "1 tuần trước",
      likes: 31,
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBAvlVSMy09abPubNkiyRJDrIfK4vi-aPYm5NjKFwX_zBpjPds3KK1fU01YyuEZth1kzMYTy1048gKwz91cU5J-v51Vyc8-EA__9MCz-DFKu4Pnk5zO-Vk6r2gaQ7cswMWoU41aDaY61lojn4_luXL3uw_DMSFx6kxwL6tnKbYdoBbigY9k1L2Z0qJiwrbHiUbfPTK60B29xAF46ALfdX1ggpi06oVTFFlq4doClMw",
      content: "Best food tour in Southeast Asia! Cô Tư took us into alleys we would never dare walk in alone. The sock coffee and Teochew noodles were phenomenal. The AI guide app made ordering and understanding local ingredients so effortless!"
    },
    {
      id: 4,
      author: "Lê Hoàng Kim",
      type: "solo",
      role: "Khách đi một mình",
      stars: 5,
      foodScore: 4.8,
      hygieneScore: 5.0,
      guideScore: 5.0,
      date: "2 tuần trước",
      likes: 12,
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBkWXX3WEIHhWcBr72f84vdhLQJUgx4Ks0FcDcBOnj2_lEGRyx_4eTYZ6KsSKvQ9Xnofz-RTE81oegrLhsu7xOGcYKYqtmh_GmGoI35orLNM75pG9f2GN_28BGWJUibBHxE1UJq5bBD53DbEkQoG_Qth_DyLHokeUOpS0BjAgd6u4J15OLCmXIU6T5oQqcZgxZqiI2fBeHum7-X9EZu4tNrzN9Nzk-2iZr990Go6yc",
      content: "Mình đi một mình lúc đầu hơi ngại, nhưng Cô Tư và các bạn trong đoàn thân thiện như người nhà. Mâm chè 16 món kết thúc đêm tour ngọt ngào thanh cảnh, mình nhận được huy hiệu Hiệp Sĩ Hẻm siêu cưng!"
    }
  ],

  // Tri thức AI Cô Tư (Hỏi đáp thông minh & giọng điệu Nam Bộ)
  aiKnowledge: {
    welcome: "Dạ Cô Tư chào con! Con đang thèm món gì hay muốn hỏi đường đi nước bước chuyến luồn hẻm tối nay, cứ nói Cô Tư nghe nghen!",
    intents: [
      {
        keywords: ["vệ sinh", "sạch", "đau bụng", "an toàn", "ngộ độc"],
        answer: "Yên tâm 100% nghen con! 5 quán hẻm này Cô Tư ăn từ thời con gái tới giờ, lò than đỏ lửa chén đĩa tráng nước sôi tinh tươm. Ai đau bụng Cô Tư đền gấp 10 lần tiền tour luôn nè!"
      },
      {
        keywords: ["cay", "ít cay", "không cay", "ớt", "sa tế"],
        answer: "Được luôn con! Món phá lấu với hủ tiếu Cô Tư dặn dì Bảy để ớt sa tế riêng ở dĩa nhỏ. Con thích nêm cay cỡ nào thì tự cho vào, ai không ăn cay được thì chỉ việc húp nước cốt dừa ngọt béo thơm lừng thôi!"
      },
      {
        keywords: ["chay", "thuần chay", "ăn chay", "dị ứng hải sản", "không ăn tôm", "không ăn bò"],
        answer: "Cô Tư lo chu tất được hết! Bánh cuốn tráng chay nhân mộc nhĩ nấm đùi gà, chè mâm thuần thực vật. Quán phá lấu Cô Tư đổi thành nấm kho nước dừa béo ngậy. Con nhớ tích vô ô 'Khẩu vị đặc biệt' lúc điền đơn để bếp chuẩn bị nghen."
      },
      {
        keywords: ["mưa", "trời mưa", "ngập", "ướt"],
        answer: "Hẻm Cô Tư chọn cao ráo không ngập con ơi! Lại có mái hiên che mát rượi. Đội ngũ Cô Tư phát áo mưa trong suốt và ô che cho từng bạn. Sài Gòn mưa rào một chút là tạnh, ngồi ăn tô hủ tiếu nóng hổi lúc trời mưa là số dzách!"
      },
      {
        keywords: ["giá", "bao nhiêu", "chi phí", "590", "phụ thu", "tiền tip"],
        answer: "Trọn gói đúng 590.000₫/khách, không phát sinh thêm một cắc bạc nào! Đã bao gồm trọn vẹn 5 trạm ăn no căng rốn, nước uống, hướng dẫn viên, tai nghe và bảo hiểm. Không có chuyện ép mua sắm như tour ngoài đường đâu nha!"
      },
      {
        keywords: ["cà phê vợt", "bít tất", "chú ba", "vợt"],
        answer: "Cà phê vợt Chú Ba nấu bằng siêu đất đun trên lò than hồng suốt 70 năm qua đó con! Chiếc vợt vải càng pha lâu càng ngấm tinh dầu cà phê làm nước sánh thơm đặc biệt, uống một ngụm là tỉnh cả người."
      },
      {
        keywords: ["đặt tour", "điền form", "giữ chỗ", "đăng ký", "tên tôi là", "tôi là"],
        answer: "Cô Tư sẵn sàng hỗ trợ con đặt chỗ liền tay! Con nhắn Cô Tư: Tên con, số điện thoại, ngày muốn đi và mấy người, Cô Tư tự động điền sẵn form cho con luôn!"
      },
      {
        keywords: ["tiếng anh", "english", "nước ngoài", "foreigner"],
        answer: "Dạ có nghen! Tour của Cô Tư có hướng dẫn viên song ngữ Anh - Việt siêu duyên dáng, am hiểu sâu văn hóa Sài Gòn xưa. Bạn bè quốc tế đi cùng bảo đảm mê tít!"
      },
      {
        keywords: ["đổi ngày", "hủy tour", "hoàn tiền", "bận việc"],
        answer: "Dạ con chỉ cần nhắn tin trước giờ đi 4 tiếng là Cô Tư hỗ trợ dời ngày miễn phí 100%. Còn hủy trước 24 giờ là Cô Tư hoàn tiền trọn gói không trừ một cắc!"
      },
      {
        keywords: ["trẻ em", "em bé", "con nít", "người già", "lớn tuổi"],
        answer: "Trẻ em dưới 10 tuổi vé chỉ 350.000₫/bé nghen con! Mỗi chặng đi bộ chỉ 5-7 phút là ghé quán ngồi nghỉ 40 phút, đường bằng phẳng an toàn nên bé và người lớn tuổi đi rất thoải mái."
      },
      {
        keywords: ["mã giảm", "voucher", "khuyến mãi", "coupon", "code"],
        answer: "Cô Tư tặng con mấy mã xịn nè: 'TIKTOK50' giảm ngay 50.000₫, 'HEMSAIGON' giảm 10% tổng hóa đơn, hoặc 'COTU2026' giảm 100.000₫ cho nhóm từ 2 khách trở lên nha!"
      }
    ]
  },

  // Danh sách tài khoản người dùng mặc định (Phân quyền Admin vs Khách hàng)
  initialUsers: [
    {
      id: "usr-admin-1",
      username: "admin",
      email: "admin@cotu-saigon.vn",
      password: "cotu@2026",
      fullName: "Quản Trị Viên Cô Tư",
      phone: "0908 287 150",
      role: "admin",
      title: "Trưởng Ban Điều Hành Tour Hẻm",
      avatar: "🛡️",
      createdAt: "2026-11-01T08:00:00.000Z"
    },
    {
      id: "usr-cust-1",
      username: "quan.tran",
      email: "quan.tran@gmail.com",
      password: "123456",
      fullName: "Trần Minh Quân",
      phone: "0912 345 678",
      role: "customer",
      dietary: "Không ăn cay, Dị ứng tôm",
      tier: "Hội Viên Thân Thiết (Gold)",
      avatar: "👤",
      createdAt: "2026-11-02T10:30:00.000Z"
    },
    {
      id: "usr-cust-2",
      username: "haiyen.ng",
      email: "haiyen.ng@outlook.com",
      password: "123456",
      fullName: "Nguyễn Hải Yến",
      phone: "0988 776 554",
      role: "customer",
      dietary: "Ăn được tất cả",
      tier: "Hội Viên Kim Cương",
      avatar: "🌸",
      createdAt: "2026-11-03T15:00:00.000Z"
    }
  ],

  // Danh sách yêu cầu Đặt Tour Trước (Pre-bookings) của Khách hàng
  initialPreBookings: [
    {
      id: "PRE-701",
      customerName: "Trần Minh Quân",
      phone: "0912 345 678",
      email: "quan.tran@gmail.com",
      targetDate: "2026-12-15",
      timeSlot: "17:30 (Chiều hoàng hôn)",
      theme: "Hẻm Ẩm Thực Chợ Lớn Sủi Cảo & Văn Hóa Người Hoa Đêm",
      guests: 6,
      estimatedBudget: "3.540.000₫",
      dietaryNotes: "Không ăn nội tạng, có 1 người ăn chay trường",
      specialRequests: "Cần hướng dẫn viên chụp ảnh film và chuẩn bị ghế riêng cho người lớn tuổi",
      status: "Đã xác nhận cọc",
      adminNotes: "Đã chốt bàn riêng tại Hẻm Gò Cống, cử HDV Hoàng Minh phụ trách",
      createdAt: "2026-11-08T09:00:00.000Z"
    },
    {
      id: "PRE-702",
      customerName: "Nguyễn Hải Yến",
      phone: "0988 776 554",
      email: "haiyen.ng@outlook.com",
      targetDate: "2026-12-24",
      timeSlot: "19:30 (Đêm Giáng Sinh)",
      theme: "Hẻm Ẩm Thực Toàn Diện 5 Trạm (Bếp Than, Cà Phê Vợt, Phá Lấu, Chè Mâm)",
      guests: 8,
      estimatedBudget: "4.720.000₫",
      dietaryNotes: "Ăn được cay, yêu cầu thêm bánh tiêu nóng tại trạm cà phê vợt",
      specialRequests: "Tổ chức sinh nhật bất ngờ cho bạn trai tại trạm Chè Mâm",
      status: "Chờ tư vấn",
      adminNotes: "Cần gọi lại lúc 18h để thống nhất khâu cắm nến bánh kem",
      createdAt: "2026-11-09T14:30:00.000Z"
    },
    {
      id: "PRE-703",
      customerName: "Đặng Thu Hương",
      phone: "0909 888 123",
      email: "thuhuong.dang@fpt.com.vn",
      targetDate: "2027-01-05",
      timeSlot: "16:30 (Chiều mát)",
      theme: "Tour Riêng Doanh Nghiệp / Teambuilding Hẻm Sài Gòn",
      guests: 15,
      estimatedBudget: "8.850.000₫",
      dietaryNotes: "3 người ăn chay thuần, 2 người kiêng bột ngọt",
      specialRequests: "Xuất hóa đơn VAT cho công ty, có thuyết minh song ngữ Anh - Việt",
      status: "Đã liên hệ",
      adminNotes: "Đã gửi báo giá qua email công ty, chờ duyệt từ phòng nhân sự",
      createdAt: "2026-11-10T11:15:00.000Z"
    }
  ],

  // Danh sách chủ đề Đặt Tour Trước
  preBookingThemes: [
    {
      id: "full-5-stops",
      name: "Hẻm Ẩm Thực Toàn Diện 5 Trạm (Bếp Củi, Cà Phê Vợt, Hủ Tiếu Hồ, Phá Lấu, Chè Mâm)",
      badge: "Phổ Biến Nhất",
      duration: "4 Tiếng (16:30 - 20:30)",
      pricePerPax: 590000
    },
    {
      id: "cholon-heritage",
      name: "Hẻm Chợ Lớn Sủi Cảo & Văn Hóa Người Hoa Đêm",
      badge: "Đậm Chất Phố Hoa",
      duration: "3.5 Tiếng (17:30 - 21:00)",
      pricePerPax: 620000
    },
    {
      id: "dakao-hearth",
      name: "Hẻm Đa Kao Bếp Than & Nồi Hơi Cổ 3 Đời",
      badge: "Văn Hóa Gia Truyền",
      duration: "3 Tiếng (16:00 - 19:00)",
      pricePerPax: 550000
    },
    {
      id: "custom-corporate",
      name: "Tour Riêng Doanh Nghiệp / Họp Mặt Gia Đình Theo Yêu Cầu",
      badge: "Thiết Kế Riêng",
      duration: "Linh hoạt theo đoàn",
      pricePerPax: 590000
    }
  ],

  // Nhật ký hành động khách hàng & quản trị viên (Customer Activities Log)
  initialActivities: [
    {
      id: "ACT-101",
      user: "Trần Minh Quân",
      role: "customer",
      action: "Đăng ký đặt tour trước",
      target: "PRE-701",
      details: "Gửi yêu cầu tour Chợ Lớn cho 6 khách ngày 15/12/2026",
      timestamp: "2026-11-08T09:00:00.000Z"
    },
    {
      id: "ACT-102",
      user: "Quản Trị Viên Cô Tư",
      role: "admin",
      action: "Duyệt đặt tour trước",
      target: "PRE-701",
      details: "Chuyển trạng thái sang 'Đã xác nhận cọc', chỉ định HDV Hoàng Minh",
      timestamp: "2026-11-08T10:15:00.000Z"
    },
    {
      id: "ACT-103",
      user: "Nguyễn Hải Yến",
      role: "customer",
      action: "Đăng ký đặt tour trước",
      target: "PRE-702",
      details: "Yêu cầu tour đêm Noel 8 khách kèm tổ chức sinh nhật",
      timestamp: "2026-11-09T14:30:00.000Z"
    },
    {
      id: "ACT-104",
      user: "Đặng Thu Hương",
      role: "customer",
      action: "Đăng ký thành viên mới",
      target: "usr-cust-3",
      details: "Đăng ký tài khoản khách hàng doanh nghiệp qua số 0909888123",
      timestamp: "2026-11-10T11:00:00.000Z"
    },
    {
      id: "ACT-105",
      user: "Trần Minh Quân",
      role: "customer",
      action: "Đặt tour trực tiếp",
      target: "CT-8291",
      details: "Đặt tour hẻm hôm nay 2 khách, thanh toán VIETQR",
      timestamp: "2026-11-10T16:00:00.000Z"
    }
  ]
};
