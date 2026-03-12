'use client';
import { useState, useEffect } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminTabs from '@/components/admin/AdminTabs';
import AdminSections from '@/components/admin/AdminSections';
import AdminContacts from '@/components/admin/AdminContacts';
import AdminSlider from '@/components/admin/AdminSlider';
import AdminSchedulePrices from '@/components/admin/AdminSchedulePrices';
import AdminPrograms from '@/components/admin/AdminPrograms';
import AdminStaffPrograms from '@/components/admin/AdminStaffPrograms'; 
import AdminSettings from '@/components/admin/AdminSettings';
import AdminNews from '@/components/admin/AdminNews';
import AdminWorkouts from '@/components/admin/AdminWorkouts';
import AutoUpload from '@/components/admin/AutoUpload';
import AdminStorage from '@/components/admin/AdminStorageNew';
import AdminStatsContainer from '@/components/admin/AdminStatsContainer';
import AdminDividers from '@/components/admin/AdminDividers';
import AdminAdditionalContacts from '@/components/admin/AdminAdditionalContacts';
import AdminHeaderSettings from '@/components/admin/AdminHeaderSettings';
import AdminDesign from '@/components/admin/AdminDesign';
import AdminHomeContainer from '@/components/admin/AdminHomeContainer';
import AdminHomeProgramsContainer from '@/components/admin/AdminHomeProgramsContainer';
import AdminHomeTrainersContainer from '@/components/admin/AdminHomeTrainersContainer';
import AdminProgramsPageContainer from '@/components/admin/AdminProgramsPageContainer';
import AdminTrainersPageContainer from '@/components/admin/AdminTrainersPageContainer';
import AdminPages from '@/components/admin/AdminPages';
import AdminFooter from '@/components/admin/AdminFooter';
import styles from './page.module.css';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [dbData, setDbData] = useState<any>({});
  const [originalData, setOriginalData] = useState<any>({});
  const [activeTab, setActiveTab] = useState('sliders');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [changesCount, setChangesCount] = useState(0);
    const     tabConfig = {
    header: { component: 'header' },
    homeContainer: { component: 'homeContainer' },
    homePrograms: { component: 'homePrograms' },
    homeTrainers: { component: 'homeTrainers' },
    programs: { component: 'programs' },
    programsCards: { component: 'programsCards' },
    trainers: { component: 'trainers' },
    trainersCards: { component: 'trainersCards' },
    sliders: { component: 'slider' }, 
    schedulePrices: { component: 'schedulePrices' },
    workouts: { component: 'workouts' },
     staff: { component: 'staff' },
     news: { component: 'news' },
     pages: { component: 'pages' },
     footer: { component: 'footer' },
   sections: { component: 'sections' },
    dividers: { component: 'dividers' },
    contacts: { component: 'contacts' },
    additionalContacts: { component: 'additionalContacts' },
    settings: { component: 'settings' },
    stats: { component: 'stats' },
    autoupload: {  component: 'autoupload',},
    files: { component: 'files' },
    design: { component: 'design' },
  };


  // ✅ АВТОРИЗАЦИЯ
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin-auth') === 'true') {
      setIsAuthenticated(true);
      loadData();
    }
  }, []);

  const loadData = async () => {
    try {
      const response = await fetch('/api/db');
      const data = await response.json();
      setDbData(data);
      setOriginalData(JSON.parse(JSON.stringify(data))); // Копия для сравнения
      setChangesCount(0);
    } catch {
      console.error('Ошибка загрузки БД');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/db');
      const db = await response.json();
      const correctPassword = db.adminPassword || db.settings?.adminPassword || 'цфр2026';

      if (password === correctPassword) {
        localStorage.setItem('admin-auth', 'true');
        setIsAuthenticated(true);
        setDbData(db);
        setOriginalData(JSON.parse(JSON.stringify(db)));
        setError('');
      } else {
        setError('❌ Неверный пароль!');
      }
    } catch {
      if (password === 'цфр2026') {
        localStorage.setItem('admin-auth', 'true');
        setIsAuthenticated(true);
        setError('');
      } else {
        setError('❌ Неверный пароль!');
      }
    }
  };

  const saveAllChanges = async () => {
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbData)
      });
      
      if (response.ok) {
        setOriginalData(JSON.parse(JSON.stringify(dbData)));
        setChangesCount(0);
        console.log('✅ Все изменения сохранены!');
      }
    } catch {
      console.error('Ошибка сохранения');
    }
  };

  const handleItemSave = (itemData: any) => {
    const newData = { ...dbData };
    const items = newData[activeTab] || [];
    
    if (editingItem) {
      newData[activeTab] = items.map((item: any) => 
        item.id === editingItem.id ? itemData : item
      );
    } else {
      newData[activeTab] = [...items, { ...itemData, id: Date.now() }];
    }
    
    setDbData(newData);
    setEditingItem(null);
    updateChangesCount(newData);
  };

  const handleItemDelete = (id: number) => {
    const newData = { ...dbData };
    newData[activeTab] = (newData[activeTab] || []).filter((item: any) => item.id !== id);
    setDbData(newData);
    updateChangesCount(newData);
  };

  const updateChangesCount = (currentData: any) => {
    const changes = JSON.stringify(currentData) !== JSON.stringify(originalData) ? 1 : 0;
    setChangesCount(changes);
  };
  const defaultContacts = {
  address: "г. Екатеринбург, ул. 8 Марта, 70 (налево за постом охраны, этаж 2)",
  email: "centr-fr@yandex.ru",
  phone: "+7 (902) 258-45-47",
  vk: "https://vk.com/tsentrrazvitiya",
  telegram: "https://t.me/+OUEDmEm3UT5kM2Qy",
  social: [
    {"id": "vk", "title": "ВКонтакте", "url": "https://vk.com/tsentrrazvitiya"},
    {"id": "telegram", "title": "Telegram", "url": "https://t.me/+OUEDmEm3UT5kM2Qy"},
    {"id": "balloo", "title": "мы в BALLOO (скоро)", "url": ""},
    {"id": "max", "title": "мы в MAX (скоро)", "url": ""}
  ]
};


  const currentConfig = tabConfig[activeTab as keyof typeof tabConfig] || { fields: [] };
  const currentItems = dbData[activeTab] || [];
const defaultSections = [
  { id: "schedule", title: "Расписание занятий", background: "yellow-orange" },
  { id: "prices", title: "Наши цены", background: "green-blue" },

];
  const handleLogout = () => {
    localStorage.removeItem('admin-auth');
    setIsAuthenticated(false);
    setDbData({});
    setPassword('');
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <h1>🔐 Админ панель</h1>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="******************"
              autoFocus
            />
            <button type="submit">Войти</button>
          </form>
          {error && <p>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <AdminHeader 
        changesCount={changesCount}
        onSave={saveAllChanges}
        dbData={dbData}
        onLogout={handleLogout}
      />
      
      <div className={styles.content}>
        <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div className={styles.mainGrid}>
          {currentConfig.component === 'header' ? (
  <AdminHeaderSettings 
    settings={dbData.headerSettings || { 
      titleSuffix: ' | Шифу Панда',
      componentsEnabled: { callButton: true, pageTitle: true, menu: true },
      componentsOrder: ['logo', 'callButton', 'pageTitle', 'menu'],
      homeMenuEnabled: true,
      logoAnimation: 'none',
      secondLineText: '',
      secondLineAnimation: 'none'
    }}
    onSave={(newSettings) => {
      const newData = { ...dbData, headerSettings: newSettings };
      setDbData(newData);
      updateChangesCount(newData);
    }}
  />
) : currentConfig.component === 'settings' ? (
  <AdminSettings 
    siteSettings={dbData.siteSettings || { logo: '', favicon: '' }}
    emailConfig={dbData.emailConfig || {}}
    onSave={(newSiteSettings, newEmailConfig) => {
      const newData = { 
        ...dbData, 
        siteSettings: newSiteSettings,
        emailConfig: newEmailConfig
      };
      setDbData(newData);
      updateChangesCount(newData);
    }}
  />
) :currentConfig.component === 'news' ? (
  <AdminNews 
    news={dbData.news || []}
    onSave={(newNews) => {
      const newData = { ...dbData, news: newNews };
      setDbData(newData);
      updateChangesCount(newData);
    }}
  />
) :currentConfig.component === 'staff' ? (  // ← НОВОЕ УСЛОВИЕ
    <AdminStaffPrograms 
      trainers={dbData.trainers || []}
      staff={dbData.staff || []}
      onSave={(newTrainers, newStaff) => {  // ← ДВА параметра!
        const newData = { 
          ...dbData, 
          trainers: newTrainers, 
          staff: newStaff 
        };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) :currentConfig.component === 'programs' ? (
  <AdminPrograms 
    programs={dbData.programs || []}
    onSave={(newPrograms) => {
      const newData = { ...dbData, programs: newPrograms };
      setDbData(newData);
      updateChangesCount(newData);
    }}
  />
) : currentConfig.component === 'schedulePrices' ? (
  <AdminSchedulePrices 
    schedule={dbData.schedule || []}
    prices={dbData.prices || []}
    news={dbData.news || []}
    onSaveSchedule={(newSchedule) => {
      const newData = { ...dbData, schedule: newSchedule };
      setDbData(newData);
      updateChangesCount(newData);
    }}
    onSavePrices={(newPrices) => {
      const newData = { ...dbData, prices: newPrices };
      setDbData(newData);
      updateChangesCount(newData);
    }}
    onAddNews={(newNews) => {
      const newData = { 
        ...dbData, 
        news: [...(dbData.news || []), newNews] 
      };
      setDbData(newData);
      updateChangesCount(newData);
    }}
  />
) : currentConfig.component === 'workouts' ? (
  <AdminWorkouts 
    workouts={dbData.workouts || []}
    programs={dbData.programs || []}
    onSave={(newWorkouts) => {
      const newData = { ...dbData, workouts: newWorkouts };
      setDbData(newData);
      updateChangesCount(newData);
    }}
  />
) :currentConfig.component === 'slider' ? (
  <AdminSlider 
    sliders={dbData.sliders || []}
    settings={dbData.sliderSettings || { textPositionMode: 'static', staticPosition: 'middle-center', marginX: 0, marginY: 0 }}
    onSave={(newSliders, newInterval, newSettings) => {
      const newData = { 
        ...dbData, 
        sliders: newSliders,
        defaultInterval: newInterval,
        sliderSettings: newSettings
      };
      setDbData(newData);
      updateChangesCount(newData);
    }}
  />
):currentConfig.component === 'contacts' ? (
  <AdminContacts 
    data={dbData.contacts || defaultContacts}
    onSave={(newContacts) => {
      const newData = { ...dbData, contacts: newContacts };
      setDbData(newData);
      updateChangesCount(newData);
    }}
  />
):currentConfig.component === 'additionalContacts' ? (
  <AdminAdditionalContacts 
    data={dbData.additionalContacts || { 
      enabled: true, 
      title: 'Подпишитесь на нас', 
      groups: [], 
      yandexMap: { 
        enabled: true, 
        center: [56.8355, 60.5972], 
        zoom: 15, 
        placemark: [56.8355, 60.5972], 
        address: 'г. Екатеринбург, ул. 8 Марта, 70' 
      } 
    }}
    onSave={(newData) => {
      const updatedDbData = { ...dbData, additionalContacts: newData };
      setDbData(updatedDbData);
      updateChangesCount(updatedDbData);
    }}
  />
) // В рендере mainGrid добавьте:
:currentConfig.component === 'autoupload' ? (
  <AutoUpload 
    autouploadData={dbData?.siteSettings?.autoupload || { 
      status: 'idle' as const, 
      log: [], 
      progress: 0 
    }}
    onSave={(newData) => {
      const updatedData = { 
        ...dbData, 
        siteSettings: {
          ...dbData.siteSettings,
          autoupload: newData
        }
      };
      setDbData(updatedData);
      updateChangesCount(updatedData);
    }}
  />
)
:currentConfig.component === 'sections' ? (
    <AdminSections 
      sections={dbData.sections || defaultSections}
      onSave={(newSections) => {
        const newData = { ...dbData, sections: newSections };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) : currentConfig.component === 'dividers' ? (
    <AdminDividers 
      dividers={dbData.globalDivider || { enabled: true, height: 'xxl', background: 'gradientBlue', textContent: '🏃 🏋️ 🧘 💪', fontSize: 'large' }}
      sections={dbData.sections || defaultSections}
      onSave={(newDivider) => {
        const newData = { ...dbData, globalDivider: newDivider };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) : currentConfig.component === 'stats' ? (
    <AdminStatsContainer />
  ) : currentConfig.component === 'files' ? (
    <AdminStorage />
  ) : currentConfig.component === 'design' ? (
    <AdminDesign 
      designSettings={dbData.designSettings || null}
      onSave={(newDesignSettings: any) => {
        const newData = { ...dbData, designSettings: newDesignSettings };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) : currentConfig.component === 'homeContainer' ? (
    <AdminHomeContainer 
      data={dbData.homeContainerSettings || {}}
      onSave={(newSettings) => {
        const newData = { ...dbData, homeContainerSettings: newSettings };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) : currentConfig.component === 'homePrograms' ? (
    <AdminHomeProgramsContainer 
      containerSettings={dbData.homeProgramsContainerSettings || {}}
      cardSettings={dbData.homeProgramsCardSettings || {}}
      onSave={(containerSettings, cardSettings) => {
        const newData = { 
          ...dbData, 
          homeProgramsContainerSettings: containerSettings,
          homeProgramsCardSettings: cardSettings
        };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) : currentConfig.component === 'homeTrainers' ? (
    <AdminHomeTrainersContainer 
      containerSettings={dbData.homeTrainersContainerSettings || {}}
      cardSettings={dbData.homeTrainersCardSettings || {}}
      onSave={(containerSettings, cardSettings) => {
        const newData = { 
          ...dbData, 
          homeTrainersContainerSettings: containerSettings,
          homeTrainersCardSettings: cardSettings
        };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) : currentConfig.component === 'programsCards' ? (
    <AdminProgramsPageContainer 
      containerSettings={dbData.programsPageContainerSettings || {}}
      cardSettings={dbData.programsPageCardSettings || {}}
      onSave={(containerSettings, cardSettings) => {
        const newData = { 
          ...dbData, 
          programsPageContainerSettings: containerSettings,
          programsPageCardSettings: cardSettings
        };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) : currentConfig.component === 'trainers' ? (
    <AdminTrainersPageContainer 
      containerSettings={dbData.trainersPageContainerSettings || {}}
      cardSettings={dbData.trainersPageCardSettings || {}}
      onSave={(containerSettings, cardSettings) => {
        const newData = { 
          ...dbData, 
          trainersPageContainerSettings: containerSettings,
          trainersPageCardSettings: cardSettings
        };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) : currentConfig.component === 'trainersCards' ? (
    <AdminTrainersPageContainer 
      containerSettings={dbData.trainersPageContainerSettings || {}}
      cardSettings={dbData.trainersPageCardSettings || {}}
      onSave={(containerSettings, cardSettings) => {
        const newData = { 
          ...dbData, 
          trainersPageContainerSettings: containerSettings,
          trainersPageCardSettings: cardSettings
        };
        setDbData(newData);
        updateChangesCount(newData);
      }}
    />
  ) : currentConfig.component === 'pages' ? (
    <AdminPages />
  ) : currentConfig.component === 'footer' ? (
    <AdminFooter />
  ) : (
    <h1>Секция в разработке!</h1>
  )}
</div>
      </div>
    </div>
  );
}
