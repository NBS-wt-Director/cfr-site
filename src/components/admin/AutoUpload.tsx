'use client';
import { useState, useEffect } from 'react';
import styles from './AutoUpload.module.css';

interface AutoUploadData {
  status: 'idle' | 'scanning' | 'parsing' | 'success' | 'error' | 'auth';
  log: string[];
  progress: number;
  folderPath?: string;
  oauthToken?: string;
  isTokenValid?: boolean;
  scanResult?: any;
  yandexAccount?: {
    login: string;
    displayName: string;
  };
}

interface AutoUploadProps {
  autouploadData: AutoUploadData;
  onSave: (data: AutoUploadData) => void;
}

export default function AutoUpload({ autouploadData, onSave }: AutoUploadProps) {
  const [folderPath, setFolderPath] = useState('');
  const [oauthToken, setOauthToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeScanType, setActiveScanType] = useState<'programs' | 'trainers' | 'sliders'>('programs');
  const [sessionLog, setSessionLog] = useState<string[]>([]);

  const safeData = autouploadData || { 
    status: 'idle' as const, 
    log: [], 
    progress: 0,
    folderPath: '',
    oauthToken: '',
    isTokenValid: false,
    scanResult: null,
    yandexAccount: undefined
  };

  const isAuthenticated = safeData.isTokenValid && safeData.oauthToken;

  useEffect(() => {
    if (safeData.folderPath) setFolderPath(safeData.folderPath);
    if (safeData.oauthToken) setOauthToken(safeData.oauthToken);
    
    // Если есть токен но нет аккаунта - проверим токен
    if (safeData.oauthToken && !safeData.yandexAccount) {
      addSessionLog('🔄 Проверяю сохранённый токен...');
      validateAndSaveToken(safeData.oauthToken);
    }
  }, [safeData.folderPath, safeData.oauthToken, safeData.yandexAccount]);

  useEffect(() => {
    const handleOAuthCallback = () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      const token = params.get('access_token');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      if (token) {
        setSessionLog(prev => [...prev, `🔑 Получен токен, проверяю...`]);
        window.history.replaceState(null, '', window.location.pathname);
        validateAndSaveToken(token);
      } else if (error) {
        setSessionLog(prev => [...prev, `❌ Ошибка авторизации: ${errorDescription || error}`]);
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    handleOAuthCallback();
    window.addEventListener('hashchange', handleOAuthCallback);
    return () => window.removeEventListener('hashchange', handleOAuthCallback);
  }, []);

  const addSessionLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    setSessionLog(prev => [...prev.slice(-50), `${timestamp}: ${message}`]);
  };

  const validateAndSaveToken = async (token: string) => {
    addSessionLog('🔑 Проверяю токен...');
    
    try {
      const response = await fetch('https://cloud-api.yandex.net/v1/disk/', {
        headers: { 'Authorization': `OAuth ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const accountInfo = {
          login: data.user?.login || 'unknown',
          displayName: data.user?.display_name || 'Яндекс'
        };
        
        addSessionLog(`✅ Авторизован: ${accountInfo.displayName} (@${accountInfo.login})`);
        
        const validData = { 
          ...safeData, 
          status: 'idle' as const, 
          progress: 100, 
          oauthToken: token,
          isTokenValid: true,
          yandexAccount: accountInfo
        };
        onSave(validData);
      } else {
        const errorText = await response.text();
        addSessionLog(`❌ Ошибка токена: ${errorText.slice(0, 100)}`);
      }
    } catch (error: any) {
      addSessionLog(`💥 Ошибка: ${error.message}`);
    }
  };

  const handleYandexLogin = () => {
    if (!clientId.trim()) {
      addSessionLog('❌ Введите Client ID');
      return;
    }

    const redirectUri = window.location.origin + '/admin';
    const authUrl = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    addSessionLog('🔐 Открываю окно авторизации...');
    
    const width = 600;
    const height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    window.open(
      authUrl,
      'yandex-auth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );
  };

  const handleLogout = () => {
    const accountName = safeData.yandexAccount?.displayName || 'unknown';
    setOauthToken('');
    setSessionLog([]);
    const clearedData = { 
      ...safeData, 
      status: 'idle' as const, 
      progress: 0,
      oauthToken: '',
      isTokenValid: false,
      yandexAccount: undefined,
      log: [],
      scanResult: null
    };
    onSave(clearedData);
    addSessionLog(`🚪 Выход из @${accountName} выполнен`);
  };

  // Проверить наличие папки на диске
  const checkFolder = async () => {
    if (!folderPath.trim() || !isAuthenticated) {
      addSessionLog('❌ Укажите путь к папке');
      return;
    }

    // Исправляем путь
    let correctPath = folderPath.trim();
    if (!correctPath.startsWith('disk:/') && !correctPath.startsWith('disk:')) {
      correctPath = 'disk:/' + correctPath;
    } else if (correctPath.startsWith('disk:') && !correctPath.startsWith('disk:/')) {
      correctPath = correctPath.replace('disk:', 'disk:/');
    }

    addSessionLog(`🔍 Проверяю папку: ${correctPath}`);
    
    try {
      const response = await fetch('/api/autoupload/check-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          folderPath: correctPath, 
          oauthToken: safeData.oauthToken
        }),
      });

      const result = await response.json();
      
      addSessionLog(`📥 Ответ получен!`);
      addSessionLog(`   success: ${result.success}`);
      addSessionLog(`   items: ${result.items?.length || 0}`);
      
      // Добавляем логи сервера в сессию
      if (result.logs && result.logs.length > 0) {
        addSessionLog('--- Логи сервера ---');
        result.logs.forEach((log: string) => addSessionLog(log));
      } else {
        addSessionLog('⚠️ Логов от сервера нет!');
      }
      
      if (result.success) {
        if (result.found) {
          addSessionLog(`✅ Папка найдена: "${result.folderName}"`);
          addSessionLog(`📁 Файлов: ${result.fileCount}`);
        } else {
          addSessionLog(`❌ Папка не найдена: ${folderPath}`);
        }
      } else {
        addSessionLog(`❌ Ошибка: ${result.error}`);
        if (result.code) addSessionLog(`🔢 Код: ${result.code}`);
      }
    } catch (error: any) {
      addSessionLog(`❌ Ошибка проверки: ${error.message}`);
    }
  };

  const scanFolder = async () => {
    if (!folderPath.trim()) {
      addSessionLog('❌ Укажите путь к папке');
      return;
    }
    if (!isAuthenticated) {
      addSessionLog('❌ Сначала авторизуйтесь');
      return;
    }

    // Исправляем путь - добавляем disk:/ если нет
    let correctPath = folderPath.trim();
    if (!correctPath.startsWith('disk:/') && !correctPath.startsWith('disk:')) {
      correctPath = 'disk:/' + correctPath;
      addSessionLog(`📝 Путь исправлен: ${correctPath}`);
    } else if (correctPath.startsWith('disk:') && !correctPath.startsWith('disk:/')) {
      correctPath = correctPath.replace('disk:', 'disk:/');
      addSessionLog(`📝 Путь исправлен: ${correctPath}`);
    }

    setIsProcessing(true);
    setSessionLog([]);
    
    const scanTypeLabel = activeScanType === 'programs' ? 'Программы' : 
                         activeScanType === 'trainers' ? 'Тренеров' : 'Слайдеры';
    
    addSessionLog(`🔍 Сканирую ${scanTypeLabel}...`);
    addSessionLog(`📂 Папка: ${folderPath}`);
    
    const scanData = { ...safeData, status: 'scanning' as const, progress: 10, scanResult: null, log: [] };
    onSave(scanData);

    try {
      addSessionLog(`📤 Отправляю запрос на сервер...`);
      
      const response = await fetch('/api/autoupload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          folderPath: correctPath, 
          oauthToken: safeData.oauthToken, 
          scanType: activeScanType 
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        addSessionLog(`✅ Найдено: ${result.validItems || 0} элементов`);
        
        const finalData = { 
          ...safeData, 
          status: 'success' as const, 
          progress: 100, 
          scanResult: result
        };
        onSave(finalData);
      } else {
        addSessionLog(`❌ ОШИБКА: ${result.error}`);
        if (result.code) addSessionLog(`🔢 Код ошибки: ${result.code}`);
        
        if (result.logs && result.logs.length > 0) {
          addSessionLog('--- Логи сервера ---');
          result.logs.forEach((l: string) => addSessionLog(l));
        }
        
        const errorData = { ...safeData, status: 'error' as const, progress: 0 };
        onSave(errorData);
      }
    } catch (error: any) {
      addSessionLog(`❌ ИСКЛЮЧЕНИЕ: ${error.message}`);
      if (error.stack) {
        addSessionLog(`Stack: ${error.stack.substring(0, 200)}`);
      }
      
      const errorData = { ...safeData, status: 'error' as const, progress: 0 };
      onSave(errorData);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>☁️ Автозагрузка контента</h3>
        <p>📄 Программы • 👨‍🏫 Тренера • 🖼️ Слайдеры</p>
      </div>

      {/* === НЕ АВТОРИЗОВАН === */}
      {!isAuthenticated ? (
        <div className={styles.authSection}>
          <div className={styles.field}>
            <label>Client ID приложения</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Ваш Client ID из oauth.yandex.ru"
              className={styles.input}
            />
            <small>
              Получить на <a href="https://oauth.yandex.ru/" target="_blank" rel="noopener">oauth.yandex.ru</a><br/>
              Приложение → Яндекс.Диск (чтение/запись)
            </small>
          </div>
          
          <button
            onClick={handleYandexLogin}
            disabled={!clientId.trim()}
            className={styles.authBtn}
          >
            🔑 Войти в Яндекс.ID
          </button>
          
          <p className={styles.hint}>
            После нажатия откроется окно Яндекса. Авторизуйтесь — и появится форма загрузки.
          </p>
        </div>
      ) : (
        /* === АВТОРИЗОВАН === */
        <div className={styles.scanSection}>
          {safeData.yandexAccount && (
            <div className={styles.accountInfo}>
              <div className={styles.avatar}>
                {safeData.yandexAccount.displayName.charAt(0).toUpperCase()}
              </div>
              <div className={styles.accountDetails}>
                <div className={styles.accountName}>{safeData.yandexAccount.displayName}</div>
                <div className={styles.accountLogin}>@{safeData.yandexAccount.login}</div>
              </div>
              <button onClick={handleLogout} className={styles.logoutLink}>
                Выйти
              </button>
            </div>
          )}

          <div className={styles.field}>
            <label>Путь к папке на Яндекс.Диске</label>
            <input
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="disk:/Моя папка"
              className={styles.input}
              disabled={isProcessing}
            />
            <small>Формат: disk:/Название папки</small>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button
              onClick={checkFolder}
              disabled={!folderPath.trim() || isProcessing}
              className={styles.checkFolderBtn}
            >
              🔍 Проверить папку
            </button>
          </div>
          
          <div className={styles.scanTypeSection}>
            <button 
              className={`${styles.scanTypeBtn} ${activeScanType === 'programs' ? styles.active : ''}`}
              onClick={() => setActiveScanType('programs')}
              disabled={isProcessing}
            >
              📄 Программы
            </button>
            <button 
              className={`${styles.scanTypeBtn} ${activeScanType === 'trainers' ? styles.active : ''}`}
              onClick={() => setActiveScanType('trainers')}
              disabled={isProcessing}
            >
              👨‍🏫 Тренера
            </button>
            <button 
              className={`${styles.scanTypeBtn} ${activeScanType === 'sliders' ? styles.active : ''}`}
              onClick={() => setActiveScanType('sliders')}
              disabled={isProcessing}
            >
              🖼️ Слайдеры
            </button>
          </div>

          <button
            onClick={scanFolder}
            disabled={!folderPath.trim() || isProcessing}
            className={`${styles.scanBtn} ${isProcessing ? styles.processing : ''}`}
          >
            {isProcessing ? `🔍 Сканирую ${activeScanType}...` : `📥 Загрузить ${activeScanType}`}
          </button>
        </div>
      )}

      <div className={styles.progressSection}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${safeData.progress}%` }} />
        </div>
        <span>{Math.round(safeData.progress)}%</span>
      </div>

      {safeData.scanResult && safeData.scanResult.items && (
        <div className={styles.resultsSection}>
          <h4>✅ Найдено: {safeData.scanResult.items.length} программ</h4>
          <div className={styles.itemsList}>
            {safeData.scanResult.items.map((item: any, index: number) => (
              <div key={index} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{item.name}</span>
                  <div className={styles.itemBadges}>
                    {item.hasDocx && <span className={styles.badgeDocx}>📄 {item.docxFiles?.length || 1} DOCX</span>}
                    {item.hasImages && <span className={styles.badgeImages}>🖼️ {item.imagePaths?.length || 0} фото</span>}
                    <span className={styles.badgeTotal}>📁 {item.totalFiles || 0} файлов</span>
                  </div>
                </div>
                
                {/* Превью изображения - показываем если есть */}
                {item.hasImages && (
                  <div className={styles.previewSection}>
                    {item.previewImage ? (
                      <img src={item.previewImage} alt={item.name} className={styles.previewImage} />
                    ) : (
                      <div className={styles.noPreview}>🖼️ {item.imagePaths?.[0]?.name || 'Изображение'}</div>
                    )}
                  </div>
                )}
                
                <div className={styles.itemDetails}>
                  {/* Текст из DOCX */}
                  {item.descriptionLines && item.descriptionLines.length > 0 && (
                    <div className={styles.descriptionSection}>
                      <div className={styles.descriptionHeader}>
                        📄 {item.descriptionFileName || 'Описание'}
                      </div>
                      <div className={styles.descriptionContent}>
                        <div className={styles.descriptionText}>
                          {item.descriptionLines.map((line: string, lineIndex: number) => (
                            <div key={lineIndex} className={styles.descriptionLine}>
                              {line}
                              {lineIndex < item.descriptionLines.length - 1 && (
                                <div className={styles.separator}>====</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Все загруженные фото */}
                  {item.uploadedImages && item.uploadedImages.length > 0 && (
                    <div className={styles.uploadedImagesSection}>
                      <div className={styles.fileGroupLabel}>🖼️ Загруженные фото ({item.uploadedImages.length}):</div>
                      <div className={styles.imagesGrid}>
                        {item.uploadedImages.map((img: any, imgIndex: number) => (
                          <div key={imgIndex} className={styles.uploadedImageItem}>
                            <img src={img.localPath} alt={img.name} className={styles.uploadedImage} />
                            <div className={styles.imageName}>{img.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Если нет текста - показываем файлы */}
                  {(!item.descriptionLines || item.descriptionLines.length === 0) && (
                    <div className={styles.fileGroup}>
                      <div className={styles.fileGroupLabel}>📋 Файлы в папке:</div>
                      <div className={styles.fileList}>
                        {item.allFiles && item.allFiles.map((f: any, fIndex: number) => (
                          <div key={fIndex} className={`${styles.fileItem} ${f.extension === 'docx' ? styles.fileDocx : ''}`}>
                            {f.extension?.toLowerCase() === 'docx' ? '📄' : '🖼️'} {f.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={styles.itemPath}>
                  📍 {item.path}
                </div>
              </div>
            ))}
          </div>
          
          <div className={styles.targetFolder}>
            📁 Папка: <strong>{safeData.scanResult.targetFolder}</strong>
          </div>
        </div>
      )}

      {/* === ПОЛНЫЙ ПРЕДПРОСМОТР РАСПАРСЕННЫХ ПРОГРАММ === */}
      {safeData.scanResult && safeData.scanResult.parsedPrograms && safeData.scanResult.parsedPrograms.length > 0 && (
        <div className={styles.parsedSection}>
          <h4>📋 Предпросмотр программ (после парсинга):</h4>
          
          {safeData.scanResult.parsedPrograms.map((program: any, index: number) => (
            <div key={index} className={styles.parsedProgramCard}>
              {/* Заголовок программы */}
              <div className={styles.parsedHeader}>
                <h3 className={styles.parsedName}>{program.parsed?.name || program.name}</h3>
                <span className={styles.parsedBadge}>✅ Распарсено</span>
              </div>

              {/* Главное фото - используем реальный путь */}
              {(program.image || program.uploadedImages?.[0]?.localPath) && (
                <div className={styles.parsedMainImage}>
                  <img src={program.image || program.uploadedImages[0]?.localPath} alt={program.name} />
                </div>
              )}

              {/* Описание */}
              {program.parsed?.description && (
                <div className={styles.parsedDescription}>
                  <strong>📝 Описание:</strong>
                  <p>{program.parsed.description}</p>
                </div>
              )}

              {/* Тренеры - показываем как ссылки если найдены в БД */}
              {program.parsed?.trainers && program.parsed.trainers.length > 0 && (
                <div className={styles.parsedTrainers}>
                  <strong>👨‍🏫 Тренеры:</strong>
                  <div className={styles.trainerList}>
                    {program.parsed.trainers.map((trainer: string, tIdx: number) => {
                      // Проверяем, найден ли тренер в БД
                      const matchedId = program.parsed.matchedTrainerIds?.[tIdx];
                      const foundTrainer = matchedId 
                        ? safeData.scanResult.existingTrainers?.find((t: any) => String(t.id) === String(matchedId))
                        : null;
                      const isMatched = !!foundTrainer;
                      const isUnmatched = program.parsed.unmatchedTrainers?.includes(trainer);
                      
                      if (isMatched && foundTrainer) {
                        // Показываем как ссылку на страницу тренера
                        return (
                          <a 
                            key={tIdx} 
                            href={`/trainers/${foundTrainer.id}`}
                            target="_blank"
                            className={`${styles.trainerLink} ${styles.trainerMatched}`}
                            title={`Перейти на страницу тренера ${foundTrainer.name}`}
                          >
                            <img 
                              src={foundTrainer.image} 
                              alt={foundTrainer.name}
                              className={styles.trainerLinkAvatar}
                            />
                            <span>{foundTrainer.name}</span>
                            <span className={styles.trainerLinkCheck}>✓</span>
                          </a>
                        );
                      }
                      
                      // Не найден - показываем просто имя
                      return (
                        <span 
                          key={tIdx} 
                          className={`${styles.trainerBadge} ${isUnmatched ? styles.trainerUnmatched : ''}`}
                          title={isUnmatched ? 'Не найден в БД - будет добавлен как имя' : 'Будет добавлен как имя'}
                        >
                          {isUnmatched ? '⚠️' : '?'} {trainer}
                        </span>
                      );
                    })}
                  </div>
                  {program.parsed.unmatchedTrainers && program.parsed.unmatchedTrainers.length > 0 && (
                    <div className={styles.unmatchedWarning}>
                      ⚠️ Не найдены в БД: {program.parsed.unmatchedTrainers.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Расписание тренировок */}
              {program.parsed?.workouts && program.parsed.workouts.length > 0 && (
                <div className={styles.parsedWorkouts}>
                  <strong>📅 Расписание:</strong>
                  <div className={styles.workoutList}>
                    {program.parsed.workouts.map((workout: any, wIdx: number) => (
                      <div key={wIdx} className={styles.workoutItem}>
                        <span className={styles.workoutDay}>{workout.day}</span>
                        <span className={styles.workoutTime}>🕐 {workout.time}</span>
                        {workout.params && workout.params.length > 0 && (
                          <span className={styles.workoutParams}>
                            {workout.params.map((p: string, i: number) => (
                              <span key={i} className={styles.paramTag}>--{p}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Галерея - используем real paths */}
              {program.parsed?.gallery && program.parsed.gallery.length > 0 && (
                <div className={styles.parsedGallery}>
                  <strong>🖼️ Галерея ({program.parsed.gallery.length} фото):</strong>
                  <div className={styles.galleryGrid}>
                    {program.parsed.gallery.map((photo: any, pIdx: number) => (
                      <div key={pIdx} className={styles.galleryItem}>
                        {/* Используем fullPath из парсинга (сервер уже сопоставил) */}
                        {photo.fullPath ? (
                          <img 
                            src={photo.fullPath} 
                            alt={photo.filename}
                            className={styles.galleryPhoto}
                          />
                        ) : (
                          <div className={styles.galleryPlaceholder}>🖼️</div>
                        )}
                        <div className={styles.galleryCaption}>
                          {photo.filename}
                          {photo.caption && <span className={styles.captionText}> - {photo.caption}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Если есть дополнительные фото (не вошедшие в галерею из docx) */}
              {program.uploadedImages && program.uploadedImages.length > (program.parsed?.gallery?.length || 0) + 1 && (
                <div className={styles.uploadedImagesSection}>
                  <div className={styles.fileGroupLabel}>📸 Дополнительные фото ({program.uploadedImages.length - (program.parsed?.gallery?.length || 0) - 1}):</div>
                  <div className={styles.imagesGrid}>
                    {program.uploadedImages.slice((program.parsed?.gallery?.length || 0) + 1).map((img: any, imgIdx: number) => (
                      <div key={imgIdx} className={styles.uploadedImageItem}>
                        <img src={img.localPath} alt={img.name} className={styles.uploadedImage} />
                        <div className={styles.imageName}>{img.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Кнопка сохранения */}
              <button 
                className={styles.saveProgramBtn}
                onClick={() => {
                  console.log('Сохраняю программу:', program);
                  alert(`Программа "${program.name}" будет сохранена в БД!`);
                }}
              >
                💾 Сохранить программу
              </button>
            </div>
          ))}
        </div>
      )}

      {sessionLog.length > 0 && (
        <div className={styles.logSection}>
          <h4>📋 Журнал сессии ({sessionLog.length})</h4>
          <div className={styles.log}>
            {sessionLog.map((entry, index) => (
              <div key={index} className={styles.logEntry}>{entry}</div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.status}>
        <span className={`${styles.statusBadge} ${styles[safeData.status]}`}>
          {safeData.status === 'idle' ? 'Готов' : 
           safeData.status === 'auth' ? 'Авторизация' : 
           safeData.status === 'scanning' ? 'Сканирую' : 
           safeData.status === 'success' ? 'Готово' : 
           safeData.status === 'error' ? 'Ошибка' : 'Готов'}
        </span>
      </div>
    </div>
  );
}
