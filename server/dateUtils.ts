import * as jalaali from 'jalaali-js';

export interface DateTimeInfo {
  shamsi: {
    year: number;
    month: number;
    day: number;
    monthName: string;
    dayOfWeek: string;
    formatted: string;
  };
  gregorian: {
    year: number;
    month: number;
    day: number;
    monthName: string;
    dayOfWeek: string;
    formatted: string;
  };
  time: {
    tehranTime: string;
    utcTime: string;
    hours: number;
    minutes: number;
    seconds: number;
  };
  fullSummary: string;
}

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

const PERSIAN_DAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'
];

const GREGORIAN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const GREGORIAN_DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export function getFullDateTimeInfo(targetDate: Date = new Date()): DateTimeInfo {
  // Iran Standard Time (UTC+3:30)
  const tehranTimeStr = targetDate.toLocaleTimeString('fa-IR', {
    timeZone: 'Asia/Tehran',
    hour12: false,
  });

  const tehranDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));

  const gy = tehranDate.getFullYear();
  const gm = tehranDate.getMonth() + 1;
  const gd = tehranDate.getDate();
  const dayIndex = tehranDate.getDay();

  const jDate = jalaali.toJalaali(gy, gm, gd);

  const shamsiMonthName = PERSIAN_MONTHS[jDate.jm - 1] || '';
  const shamsiDayOfWeek = PERSIAN_DAYS[dayIndex] || '';
  const shamsiFormatted = `${shamsiDayOfWeek} ${jDate.jd} ${shamsiMonthName} ${jDate.jy}`;

  const gregMonthName = GREGORIAN_MONTHS[gm - 1] || '';
  const gregDayOfWeek = GREGORIAN_DAYS[dayIndex] || '';
  const gregFormatted = `${gregDayOfWeek}, ${gregMonthName} ${gd}, ${gy}`;

  const hours = tehranDate.getHours();
  const minutes = tehranDate.getMinutes();
  const seconds = tehranDate.getSeconds();

  const fullSummary = `تاریخ امروز: ${shamsiFormatted} (شمسی) برابر با ${gregFormatted} (میلادی). ساعت فعلی تهران: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return {
    shamsi: {
      year: jDate.jy,
      month: jDate.jm,
      day: jDate.jd,
      monthName: shamsiMonthName,
      dayOfWeek: shamsiDayOfWeek,
      formatted: shamsiFormatted,
    },
    gregorian: {
      year: gy,
      month: gm,
      day: gd,
      monthName: gregMonthName,
      dayOfWeek: gregDayOfWeek,
      formatted: gregFormatted,
    },
    time: {
      tehranTime: tehranTimeStr,
      utcTime: targetDate.toUTCString(),
      hours,
      minutes,
      seconds,
    },
    fullSummary,
  };
}
