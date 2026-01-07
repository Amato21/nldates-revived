/**
 * Module pour le formatage de dates
 */

/**
 * Classe pour formater des dates
 */
export class DateFormatter {
  /**
   * Formate une date selon le format spécifié
   * @param date La date à formater
   * @param format Le format de date (format Moment.js)
   * @returns La date formatée en string
   */
  static format(date: Date, format: string): string {
    return window.moment(date).format(format);
  }

  /**
   * Formate une date avec heure
   * @param date La date à formater
   * @param dateFormat Le format de date
   * @param timeFormat Le format d'heure
   * @param separator Le séparateur entre date et heure (défaut: " ")
   * @returns La date formatée avec l'heure
   */
  static formatWithTime(
    date: Date,
    dateFormat: string,
    timeFormat: string,
    separator: string = " "
  ): string {
    const dateStr = this.format(date, dateFormat);
    const timeStr = this.format(date, timeFormat);
    return `${dateStr}${separator}${timeStr}`;
  }
}

