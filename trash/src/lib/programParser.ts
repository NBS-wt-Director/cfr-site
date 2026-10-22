/**
 * Парсер программы из текстового формата
 * 
 * Формат документа:
 * ===
 * Название программы
 * ===
 * Описание программы
 * ===
 * Тренер1, Тренер2, Тренер3
 * ===
 * Понедельник:: 10:00 --параметр1 --параметр2;Вторник:: 14:00;Среда:: 16:00;
 * ===
 * main-photo.jpg
 * ===
 * photo1.jpg::комментарий;photo2.jpg::;photo3::;
 */

export interface ParsedProgram {
  name: string;
  description: string;
  trainers: string[];
  workouts: ParsedWorkout[];
  mainImage: string;
  gallery: ParsedPhoto[];
}

export interface ParsedWorkout {
  day: string;
  time: string;
  params: string[];
}

export interface ParsedPhoto {
  filename: string;
  caption: string;
}

export interface DbProgram {
  id: number;
  name: string;
  description: string;
  image: string;
  photoAlbum: Array<{ image: string; caption: string }>;
  trainers: string[];
  workouts: Array<{ day: string; time: string; params: string[] }>;
}

export interface Trainer {
  id: number | string;
  name: string;
  image: string;
  experience?: string;
}

/**
 * Основная функция парсинга
 */
export function parseProgramDocument(content: string): ParsedProgram | null {
  try {
    // Разделяем по ==== (4 и более знаков равно)
    const sections = content
      .split(/^={4,}$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sections.length < 2) {
      console.error('❌ Недостаточно секций. Нужно минимум 2 (название + описание), найдено:', sections.length);
      return null;
    }

    // Минимально требуется название и описание
    const name = sections[0] || '';
    const description = sections[1] || '';
    
    // Остальные секции опциональны
    const trainers = sections[2] ? parseTrainers(sections[2]) : [];
    const workouts = sections[3] ? parseWorkouts(sections[3]) : [];
    const mainImage = sections[4] || '';
    const gallery = sections[5] ? parseGallery(sections[5]) : [];

    return {
      name,
      description,
      trainers,
      workouts,
      mainImage,
      gallery,
    };
  } catch (error) {
    console.error('❌ Ошибка парсинга программы:', error);
    return null;
  }
}

/**
 * Парсинг тренеров (через запятую)
 */
function parseTrainers(trainersSection: string): string[] {
  return trainersSection
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

/**
 * Парсинг тренировок
 * Формат: день:: время --параметр1 --параметр2; ...
 */
function parseWorkouts(workoutsSection: string): ParsedWorkout[] {
  const workouts: ParsedWorkout[] = [];
  
  // Разделяем по ;
  const entries = workoutsSection.split(';').filter(e => e.trim().length > 0);
  
  for (const entry of entries) {
    const parts = entry.split('::');
    if (parts.length < 2) continue;
    
    const day = parts[0].trim();
    const timeAndParams = parts[1].trim();
    
    // Разделяем время и параметры
    const timeMatch = timeAndParams.match(/^(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : '';
    
    // Параметры начинаются с --
    const paramsMatch = timeAndParams.match(/--(\S+)/g);
    const params = paramsMatch ? paramsMatch.map(p => p.replace('--', '')) : [];
    
    workouts.push({ day, time, params });
  }
  
  return workouts;
}

/**
 * Парсинг галереи
 * Формат: filename::caption; ...
 * Если caption меньше 5 символов - считаем что нет
 */
function parseGallery(gallerySection: string): ParsedPhoto[] {
  const photos: ParsedPhoto[] = [];
  
  const entries = gallerySection.split(';').filter(e => e.trim().length > 0);
  
  for (const entry of entries) {
    const parts = entry.split('::');
    const filename = parts[0].trim();
    const caption = parts[1]?.trim() || '';
    
    // Если caption меньше 5 символов - считаем что нет
    const finalCaption = caption.length >= 5 ? caption : '';
    
    if (filename) {
      photos.push({ filename, caption: finalCaption });
    }
  }
  
  return photos;
}

/**
 * Нормализация имени: убирает лишние пробелы и приводит к нижнему регистру
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Перестановка слов в имени (для ФИО)
 * "Иванов Иван" -> ["иванов иван", "иван иванов"]
 */
function getNameVariations(name: string): string[] {
  const normalized = normalizeName(name);
  const words = normalized.split(' ');
  
  if (words.length <= 1) {
    return [normalized];
  }
  
  // Все возможные перестановки слов
  const variations: string[] = [normalized];
  
  // Обратный порядок (Иванов Иван -> Иван Иванов)
  variations.push([...words].reverse().join(' '));
  
  // Если 3 слова (Фамилия Имя Отчество), пробуем разные комбинации
  if (words.length >= 3) {
    // Фамилия + Имя + Отчество
    variations.push(`${words[0]} ${words[1]} ${words[2]}`);
    // Имя + Фамилия + Отчество
    variations.push(`${words[1]} ${words[0]} ${words[2]}`);
    // Имя + Отчество + Фамилия
    variations.push(`${words[1]} ${words[2]} ${words[0]}`);
  }
  
  return [...new Set(variations)];
}

/**
 * Проверка совпадения двух имен (с учётом перестановок и регистра)
 */
export function namesMatch(parsedName: string, existingName: string): boolean {
  const parsedVariations = getNameVariations(parsedName);
  const existingNormalized = normalizeName(existingName);
  
  // Точное совпадение с любой перестановкой
  if (parsedVariations.includes(existingNormalized)) {
    return true;
  }
  
  // Частичное совпадение: проверяем каждое слово
  const parsedWords = normalizeName(parsedName).split(' ');
  const existingWords = normalizeName(existingName).split(' ');
  
  // Считаем совпадающие слова
  let matchedWords = 0;
  for (const pWord of parsedWords) {
    for (const eWord of existingWords) {
      if (pWord === eWord || pWord.includes(eWord) || eWord.includes(pWord)) {
        matchedWords++;
        break;
      }
    }
  }
  
  // Если совпало более половины слов - считаем совпадением
  const minLength = Math.min(parsedWords.length, existingWords.length);
  if (minLength > 0 && matchedWords >= Math.ceil(minLength / 2)) {
    return true;
  }
  
  return false;
}

/**
 * Сопоставление тренеров с уже загруженными
 * Возвращает массив id тренеров, которые найдены в БД
 * Улучшенный поиск: перестановка слов + разные регистры + частичное совпадение
 */
export function matchTrainers(
  parsedTrainerNames: string[],
  existingTrainers: Trainer[]
): string[] {
  const matchedIds: string[] = [];
  
  for (const trainerName of parsedTrainerNames) {
    // Ищем тренера по имени с учётом перестановок и регистра
    const found = existingTrainers.find((t: Trainer) => 
      namesMatch(trainerName, t.name)
    );
    
    if (found) {
      matchedIds.push(String(found.id));
    }
  }
  
  return matchedIds;
}

/**
 * Конвертация в формат БД
 */
export function toDbProgram(
  parsed: ParsedProgram,
  programFolder: string,  // папка с фото, напр: "/uploads/Борьба"
  matchedTrainerIds: string[] = []
): DbProgram {
  return {
    id: Date.now(),
    name: parsed.name,
    description: parsed.description,
    // Главное фото - полный путь
    image: `${programFolder}/${parsed.mainImage}`,
    // Галерея - массив объектов с image и caption
    photoAlbum: parsed.gallery.map(photo => ({
      image: `${programFolder}/${photo.filename}`,
      caption: photo.caption,
    })),
    // Тренеры - массив ID (matchedTrainerIds) или имена если не найдены
    trainers: matchedTrainerIds.length > 0 
      ? matchedTrainerIds 
      : parsed.trainers,
    // Тренировки
    workouts: parsed.workouts.map(w => ({
      day: w.day,
      time: w.time,
      params: w.params,
    })),
  };
}

/**
 * Формирование JSON для сохранения программы
 */
export function createProgramJson(
  parsed: ParsedProgram,
  programFolder: string,
  existingTrainers: Trainer[]
): DbProgram {
  // Сопоставляем тренеров
  const matchedTrainerIds = matchTrainers(parsed.trainers, existingTrainers);
  
  return toDbProgram(parsed, programFolder, matchedTrainerIds);
}
