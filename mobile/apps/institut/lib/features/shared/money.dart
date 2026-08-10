String formatEuros(int cents) {
  final euros = cents / 100;
  final whole = euros.truncate();
  final frac = (cents.abs() % 100).toString().padLeft(2, '0');
  return '$whole,$frac €';
}
