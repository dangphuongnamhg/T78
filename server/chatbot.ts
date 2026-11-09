/** Lightweight Vietnamese keyword support for demo mode; it does not diagnose. */
export function normalizeVietnamese(value: string) {
  return value.toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const hasAny = (text: string, phrases: string[]) => phrases.some((phrase) => text.includes(normalizeVietnamese(phrase)))

const emotionWords: Record<string, string[]> = {
  lo_lắng: ['lo lắng', 'lo quá', 'hồi hộp', 'sợ hãi', 'bất an', 'hoang mang', 'run quá', 'overthinking'],
  buồn: ['buồn', 'tủi thân', 'cô đơn', 'thất vọng', 'khóc', 'chán nản', 'trống rỗng'],
  căng_thẳng: ['căng thẳng', 'áp lực', 'quá tải', 'kiệt sức', 'mệt mỏi', 'deadline', 'thi cử', 'bài tập'],
  tức_giận: ['tức giận', 'bực mình', 'khó chịu', 'ghét', 'ức chế'],
  vui: ['vui vẻ', 'hạnh phúc', 'háo hức', 'tuyệt vời', 'phấn khởi', 'tự hào'],
}

export function detectEmotion(text: string) {
  const normalized = normalizeVietnamese(text)
  for (const [emotion, words] of Object.entries(emotionWords)) {
    if (words.some((word) => normalized.includes(normalizeVietnamese(word)))) return emotion.replace('_', ' ')
  }
  return 'trung tính'
}

const directRisk = [
  'muốn tự tử', 'muốn tự sát', 'tự tử mình', 'tự sát mình', 'không muốn sống',
  'kết thúc cuộc đời', 'muốn biến mất mãi', 'tự làm đau mình', 'tự hại mình',
]
const riskContext = [
  'không còn đường', 'không chịu nổi', 'không ai quan tâm', 'không thể tiếp tục',
  'muốn chết', 'làm đau bản thân', 'không an toàn',
]

export function isHighRisk(text: string) {
  const normalized = normalizeVietnamese(text)
  return hasAny(normalized, directRisk) || riskContext.filter((phrase) => normalized.includes(normalizeVietnamese(phrase))).length >= 2
}

export function mockReply(text: string, emotion: string) {
  const t = normalizeVietnamese(text)

  if (hasAny(t, ['bị bắt nạt', 'bị đánh', 'bị đe dọa', 'bị trêu chọc', 'bị cô lập', 'bắt nạt ở trường', 'quấy rối'])) {
    return 'Mình rất tiếc vì bạn đang gặp chuyện này. Bị bắt nạt không phải lỗi của bạn. Hãy tìm người lớn bạn tin tưởng (phụ huynh, thầy cô hoặc tư vấn học đường) và kể cụ thể điều đã xảy ra; nếu đang bị đe dọa, hãy ở cạnh người lớn và đừng tự đối đầu một mình. Hiện giờ bạn có đang ở nơi an toàn không?'
  }

  if (hasAny(t, ['thi cử', 'kiểm tra', 'bài tập', 'điểm số', 'deadline', 'thi học kỳ', 'không theo kịp bài'])) {
    return 'Nghe như chuyện học đang làm bạn khá áp lực. Mình thử chia nhỏ nhé: chọn một việc cần làm trước, đặt hẹn 15 phút rồi nghỉ ngắn; bạn không cần giải quyết mọi thứ cùng lúc. Môn hoặc bài nào đang làm bạn lo nhất?'
  }

  if (hasAny(t, ['cãi nhau với bạn', 'mâu thuẫn với bạn', 'bạn thân', 'không chơi với mình', 'nhóm bạn', 'bị bỏ rơi', 'bạn bè'])) {
    return 'Chuyện với bạn bè đôi khi làm mình buồn và rối. Nếu thấy phù hợp, bạn có thể đợi lúc cả hai bình tĩnh rồi nói điều mình cảm thấy bằng câu bắt đầu với “Mình thấy…”. Bạn muốn kể thêm chuyện gì đã xảy ra không?'
  }

  if (hasAny(t, ['bố mẹ', 'ba mẹ', 'cha mẹ', 'gia đình', 'người thân', 'ở nhà'])) {
    return 'Cảm ơn bạn đã kể với Mây. Chuyện trong gia đình có thể khó nói một mình; nếu có người lớn khác bạn tin tưởng, như cô chú, anh chị hoặc thầy cô, bạn có thể nhờ họ lắng nghe. Điều gì khiến bạn thấy nặng lòng nhất lúc này?'
  }

  if (hasAny(t, ['mất ngủ', 'khó ngủ', 'thức khuya', 'không ngủ được', 'mệt mỏi', 'kiệt sức'])) {
    return 'Nghe như cơ thể bạn đang cần được nghỉ. Nếu có thể, thử rời màn hình vài phút, uống chút nước và thả lỏng vai; chuyện học có thể chờ đến khi bạn tỉnh táo hơn. Tình trạng khó ngủ hoặc mệt mỏi này đã kéo dài lâu chưa?'
  }

  if (hasAny(t, ['cô đơn', 'không có ai', 'không ai hiểu', 'bị bỏ rơi', 'không có bạn'])) {
    return 'Cảm giác cô đơn có thể nặng nề lắm. Bạn không cần nghĩ ra lời hoàn hảo đâu — thử nhắn một người bạn tin “cậu rảnh nói chuyện với mình một chút không?” cũng được. Có ai khiến bạn cảm thấy tương đối an toàn để liên hệ không?'
  }

  if (emotion === 'lo lắng') {
    return 'Nghe như có điều gì đó đang khiến bạn bồn chồn. Thử cùng Mây hít vào chậm 4 nhịp, thở ra 6 nhịp vài lần nhé. Điều gì đang làm bạn lo nhất lúc này?'
  }
  if (emotion === 'buồn') {
    return 'Cảm ơn bạn đã kể cho Mây nghe. Có vẻ hôm nay lòng bạn đang nặng một chút. Bạn muốn kể thêm điều gì khiến cảm giác ấy xuất hiện, hay muốn cùng nghĩ một việc nhỏ giúp mình dễ chịu hơn?'
  }
  if (emotion === 'căng thẳng') {
    return 'Nghe có vẻ bạn đang phải ôm khá nhiều thứ cùng lúc. Mình thử chọn một việc nhỏ nhất có thể làm trước nhé — hoặc cho mình nghỉ 5 phút cũng được. Điều gì đang khiến bạn thấy áp lực nhất?'
  }
  if (emotion === 'tức giận') {
    return 'Cảm ơn bạn đã nói ra. Khi đang bực, mình có thể tạm lùi lại và thở chậm trước khi quyết định làm gì. Bạn muốn Mây chỉ lắng nghe hay cùng nghĩ cách xử lý chuyện này?'
  }
  if (emotion === 'vui') {
    return 'Nghe thật vui khi bạn chia sẻ điều này với Mây! Bạn muốn kể thêm khoảnh khắc nào làm hôm nay trở nên đặc biệt không?'
  }
  return 'Cảm ơn bạn đã ghé trò chuyện cùng Mây. Không cần phải có chuyện gì lớn mới được chia sẻ đâu. Hôm nay có điều gì đang quanh quẩn trong đầu bạn không?'
}
