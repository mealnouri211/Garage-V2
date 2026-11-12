/* Vehicle database: make -> models, each model has a size/price class.
   Classes:  S small · M medium/sedan · L large SUV/pickup/van · P premium/luxury · X exotic/ultra-luxury
   Origin decides which maintenance packages apply: jp (Japanese), us (American), eu (European), asia (Korean/Chinese; uses the Japanese services).
   This is a starter list. Missing a model? The customer can pick "Other" and choose a size, and you can add models here. */
(() => {
  'use strict';
  const MAKES = [
    // id, English, Arabic, origin, "Model:Class, Model:Class ..."
    ['toyota', 'Toyota', 'تويوتا', 'jp', 'Yaris:S, Corolla:M, Camry:M, Avalon:M, Crown:M, Rav4:M, Corolla Cross:M, Raize:S, Veloz:M, Fortuner:L, Prado:L, Land Cruiser:L, Sequoia:L, Highlander:L, Innova:L, Hilux:L, Tundra:L, FJ Cruiser:L, Rush:M, Supra:P, GR86:P, C-HR:M'],
    ['lexus', 'Lexus', 'لكزس', 'jp', 'IS:P, ES:P, GS:P, LS:P, NX:P, RX:P, GX:L, LX:L, UX:P, RC:P, LC:X'],
    ['nissan', 'Nissan', 'نيسان', 'jp', 'Sunny:S, Versa:S, Sentra:M, Altima:M, Maxima:M, Kicks:M, X-Trail:M, Rogue:M, Murano:L, Pathfinder:L, Patrol:L, Armada:L, Navara:L, Juke:S, GT-R:X, 370Z:P, Z:P'],
    ['infiniti', 'Infiniti', 'إنفينيتي', 'jp', 'Q50:P, Q60:P, QX50:P, QX55:P, QX60:P, QX80:L'],
    ['honda', 'Honda', 'هوندا', 'jp', 'Civic:M, Accord:M, City:S, Jazz:S, CR-V:M, HR-V:M, Pilot:L, Odyssey:L, Civic Type R:P'],
    ['mazda', 'Mazda', 'مازدا', 'jp', 'Mazda2:S, Mazda3:M, Mazda6:M, CX-3:S, CX-30:M, CX-5:M, CX-9:L, MX-5:P'],
    ['mitsubishi', 'Mitsubishi', 'ميتسوبيشي', 'jp', 'Attrage:S, Lancer:M, ASX:M, Eclipse Cross:M, Outlander:M, Pajero:L, Montero Sport:L, L200:L, Xpander:M'],
    ['subaru', 'Subaru', 'سوبارو', 'jp', 'Impreza:M, XV:M, Forester:M, Outback:M, Legacy:M, WRX:P, BRZ:P'],
    ['suzuki', 'Suzuki', 'سوزوكي', 'jp', 'Swift:S, Dzire:S, Baleno:S, Ciaz:S, Vitara:M, Jimny:S, Ertiga:M'],
    ['isuzu', 'Isuzu', 'إيسوزو', 'jp', 'D-Max:L, MU-X:L'],
    ['hyundai', 'Hyundai', 'هيونداي', 'asia', 'i10:S, Accent:S, Elantra:M, Sonata:M, Azera:M, Tucson:M, Creta:M, Santa Fe:L, Palisade:L, Kona:S, Veloster:M, Staria:L, Genesis G80:P'],
    ['kia', 'Kia', 'كيا', 'asia', 'Picanto:S, Rio:S, Cerato:M, K5:M, Optima:M, Sportage:M, Seltos:M, Sorento:L, Telluride:L, Carnival:L, Stinger:P, Cadenza:M'],
    ['genesis', 'Genesis', 'جينيسيس', 'asia', 'G70:P, G80:P, G90:P, GV70:P, GV80:P'],
    ['mg', 'MG', 'إم جي', 'asia', 'MG3:S, MG5:M, MG6:M, ZS:M, HS:M, RX5:M, RX8:L, Marvel R:M'],
    ['chery', 'Chery / Jetour', 'شيري / جيتور', 'asia', 'Arrizo:M, Tiggo 4:M, Tiggo 7:M, Tiggo 8:L, Jetour X70:M, Jetour X90:L, Jetour Dashing:M'],
    ['geely', 'Geely', 'جيلي', 'asia', 'Emgrand:M, Coolray:M, Azkarra:M, Okavango:L, Monjaro:L'],
    ['haval', 'Haval / GWM', 'هافال', 'asia', 'Jolion:M, H6:M, H9:L, Dargo:L, Tank 300:L, Tank 500:L'],
    ['changan', 'Changan', 'شانجان', 'asia', 'Alsvin:S, Eado:M, CS35:M, CS75:M, UNI-T:M, UNI-K:L, Hunter:L'],
    ['byd', 'BYD', 'بي واي دي', 'asia', 'Seagull:S, Dolphin:S, Seal:M, Atto 3:M, Han:P, Tang:L, Song Plus:M'],
    ['ford', 'Ford', 'فورد', 'us', 'Fusion:M, Taurus:M, Focus:M, EcoSport:S, Escape:M, Edge:L, Explorer:L, Expedition:L, F-150:L, Ranger:L, Bronco:L, Mustang:P, Mustang Shelby GT500:X'],
    ['chevrolet', 'Chevrolet', 'شيفروليه', 'us', 'Spark:S, Aveo:S, Cruze:M, Malibu:M, Impala:M, Captiva:M, Equinox:M, Blazer:L, Traverse:L, Tahoe:L, Suburban:L, Silverado:L, Camaro:P, Corvette:X'],
    ['gmc', 'GMC', 'جي إم سي', 'us', 'Terrain:M, Acadia:L, Yukon:L, Yukon Denali:L, Sierra:L'],
    ['cadillac', 'Cadillac', 'كاديلاك', 'us', 'ATS:P, CT5:P, XT4:P, XT5:P, XT6:P, Escalade:L, CTS-V:P'],
    ['dodge', 'Dodge', 'دودج', 'us', 'Charger:P, Challenger:P, Durango:L, Ram 1500:L'],
    ['jeep', 'Jeep', 'جيب', 'us', 'Renegade:S, Compass:M, Cherokee:M, Grand Cherokee:L, Wrangler:L, Gladiator:L, Wagoneer:L'],
    ['chrysler', 'Chrysler', 'كرايسلر', 'us', '300C:P, Pacifica:L'],
    ['lincoln', 'Lincoln', 'لنكولن', 'us', 'Navigator:L, Aviator:L, Corsair:P, Continental:P'],
    ['tesla', 'Tesla', 'تسلا', 'us', 'Model 3:P, Model Y:P, Model S:P, Model X:P, Cybertruck:L'],
    ['bmw', 'BMW', 'بي إم دبليو', 'eu', '1 Series:M, 2 Series:M, 3 Series:P, 4 Series:P, 5 Series:P, 7 Series:P, 8 Series:P, X1:P, X2:P, X3:P, X4:P, X5:P, X6:P, X7:L, M2:P, M3:P, M4:P, M5:X, Z4:P, i4:P, iX:P'],
    ['mercedes', 'Mercedes-Benz', 'مرسيدس', 'eu', 'A-Class:P, C-Class:P, E-Class:P, S-Class:X, CLA:P, CLS:P, GLA:P, GLC:P, GLE:P, GLS:L, G-Class:X, AMG GT:X, SL:X, V-Class:L, Maybach:X'],
    ['audi', 'Audi', 'أودي', 'eu', 'A3:P, A4:P, A5:P, A6:P, A7:P, A8:P, Q2:P, Q3:P, Q5:P, Q7:P, Q8:P, TT:P, R8:X, RS3:P, RS6:X, RS Q8:X, e-tron:P'],
    ['volkswagen', 'Volkswagen', 'فولكس واجن', 'eu', 'Polo:S, Golf:M, Jetta:M, Passat:M, Tiguan:M, Touareg:L, Teramont:L, ID.4:M, Arteon:P'],
    ['porsche', 'Porsche', 'بورش', 'eu', 'Macan:P, Cayenne:X, Panamera:X, Taycan:X, 911:X, 718 Cayman:X, 718 Boxster:X'],
    ['landrover', 'Land Rover', 'لاند روفر', 'eu', 'Defender:L, Discovery:L, Discovery Sport:P, Range Rover Evoque:P, Range Rover Velar:P, Range Rover Sport:L, Range Rover:L'],
    ['jaguar', 'Jaguar', 'جاغوار', 'eu', 'XE:P, XF:P, XJ:P, F-Pace:P, E-Pace:P, F-Type:X'],
    ['volvo', 'Volvo', 'فولفو', 'eu', 'S60:P, S90:P, V60:P, XC40:P, XC60:P, XC90:P'],
    ['mini', 'MINI', 'ميني', 'eu', 'Cooper:S, Countryman:P, Clubman:P'],
    ['peugeot', 'Peugeot', 'بيجو', 'eu', '208:S, 301:S, 308:M, 508:M, 2008:M, 3008:M, 5008:L'],
    ['renault', 'Renault', 'رينو', 'eu', 'Clio:S, Megane:M, Duster:M, Koleos:M, Captur:S'],
    ['fiat', 'Fiat / Alfa Romeo', 'فيات / ألفا روميو', 'eu', 'Fiat 500:S, Giulia:P, Stelvio:P'],
    ['maserati', 'Maserati', 'مازيراتي', 'eu', 'Ghibli:X, Levante:X, Quattroporte:X, MC20:X, Grecale:X'],
    ['bentley', 'Bentley', 'بنتلي', 'eu', 'Continental GT:X, Flying Spur:X, Bentayga:X'],
    ['rollsroyce', 'Rolls-Royce', 'رولز رويس', 'eu', 'Ghost:X, Wraith:X, Cullinan:X, Phantom:X'],
    ['ferrari', 'Ferrari', 'فيراري', 'eu', 'Roma:X, Portofino:X, 296:X, F8:X, SF90:X, Purosangue:X'],
    ['lamborghini', 'Lamborghini', 'لامبورغيني', 'eu', 'Huracan:X, Urus:X, Revuelto:X'],
    ['mclaren', 'McLaren', 'ماكلارين', 'eu', 'GT:X, 720S:X, Artura:X'],
    ['astonmartin', 'Aston Martin', 'أستون مارتن', 'eu', 'Vantage:X, DB11:X, DBX:X']
  ];

  const MAKE_LIST = MAKES.map(([id, en, ar, origin, models]) => ({
    id, en, ar, origin,
    models: models.split(',').map((m) => { const [name, cls] = m.trim().split(':'); return { name, cls }; })
  }));

  const CLASS_INFO = {
    S: { ar: 'صغيرة', en: 'Small', ex: 'Yaris, Picanto, Swift' },
    M: { ar: 'متوسطة / سيدان', en: 'Medium / sedan', ex: 'Camry, Elantra, CX-5' },
    L: { ar: 'كبيرة / دفع رباعي / بيك أب', en: 'Large SUV / pickup', ex: 'Prado, Tahoe, F-150' },
    P: { ar: 'فاخرة', en: 'Premium', ex: '3 Series, GLC, Macan' },
    X: { ar: 'فاخرة جداً / رياضية', en: 'Luxury / exotic', ex: 'S-Class, G-Class, 911' }
  };

  const ORIGIN_INFO = {
    jp: { ar: 'ياباني', en: 'Japanese' }, us: { ar: 'أمريكي', en: 'American' },
    eu: { ar: 'أوروبي', en: 'European' }, asia: { ar: 'آسيوي (كوري / صيني)', en: 'Asian (Korean / Chinese)' }
  };

  const findMake = (id) => MAKE_LIST.find((m) => m.id === id);

  /* Build the car object the rest of the app uses. */
  function makeCar(makeId, modelName, year) {
    const mk = findMake(makeId); if (!mk) return null;
    const md = mk.models.find((m) => m.name === modelName); if (!md) return null;
    return { id: `${mk.id}|${md.name}|${year || ''}`, make: mk.en, makeAr: mk.ar, makeId: mk.id, model: md.name, year: year ? Number(year) : null, cls: md.cls, origin: mk.origin, custom: false };
  }
  /* A car that is not in the list: customer types it and picks a size. */
  function customCar(make, model, year, cls, origin) {
    return { id: `custom|${make}|${model}|${year || ''}`, make, makeAr: make, makeId: 'other', model, year: year ? Number(year) : null, cls: cls || 'M', origin: origin || 'jp', custom: true };
  }
  const carName = (c, lang) => c ? `${lang === 'ar' ? c.makeAr : c.make} ${c.model}${c.year ? ' ' + c.year : ''}` : '';

  Object.assign(window.HW, { MAKES: MAKE_LIST, CLASS_INFO, ORIGIN_INFO, findMake, makeCar, customCar, carName });
})();
