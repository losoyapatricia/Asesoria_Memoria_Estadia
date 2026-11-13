import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

void main() => runApp(const VelocimetroApp());

class VelocimetroApp extends StatelessWidget {
  const VelocimetroApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Velocímetro GPS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00E5A0),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const SpeedometerScreen(),
    );
  }
}

class SpeedometerScreen extends StatefulWidget {
  const SpeedometerScreen({super.key});

  @override
  State<SpeedometerScreen> createState() => _SpeedometerScreenState();
}

class _SpeedometerScreenState extends State<SpeedometerScreen> {
  static const double maxDisplaySpeed = 200; // km/h en el dial

  StreamSubscription<Position>? _sub;
  bool _running = false;
  bool _permissionDenied = false;
  String? _error;

  double _speedKmh = 0;      // suavizada (EMA)
  double _instantKmh = 0;    // instantánea
  double _maxSpeedKmh = 0;
  double _distanceM = 0;

  DateTime? _lastFixTime;
  Position? _lastPosition;

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<bool> _ensurePermissions() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      setState(() => _error = 'Activa el GPS del dispositivo');
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      setState(() => _permissionDenied = true);
      return false;
    }
    return true;
  }

  Future<void> _start() async {
    if (_running) return;
    if (!await _ensurePermissions()) return;

    setState(() {
      _running = true;
      _error = null;
      _speedKmh = 0;
      _instantKmh = 0;
      _maxSpeedKmh = 0;
      _distanceM = 0;
      _lastFixTime = null;
      _lastPosition = null;
    });

    _sub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
      ),
    ).listen(_onPosition, onError: (Object e) {
      setState(() => _error = 'Error de GPS: $e');
    });
  }

  Future<void> _stop() async {
    await _sub?.cancel();
    _sub = null;
    if (mounted) setState(() => _running = false);
  }

  void _onPosition(Position p) {
    if (!mounted) return;

    // Velocidad reportada por el GPS (m/s) o calculada por distancia/tiempo
    double instantMps = p.speed;
    final now = DateTime.now();
    if (instantMps <= 0 && _lastPosition != null && _lastFixTime != null) {
      final dt = now.difference(_lastFixTime!).inMilliseconds / 1000.0;
      if (dt > 0.2) {
        final d = Geolocator.distanceBetween(
          _lastPosition!.latitude, _lastPosition!.longitude,
          p.latitude, p.longitude,
        );
        instantMps = d / dt;
      }
    }

    final instantKmh = instantMps * 3.6;

    // Suavizado exponencial para evitar saltos del GPS
    setState(() {
      _instantKmh = instantKmh;
      _speedKmh = _speedKmh == 0 ? instantKmh : _speedKmh * 0.7 + instantKmh * 0.3;
      if (_speedKmh > _maxSpeedKmh) _maxSpeedKmh = _speedKmh;
      if (_lastPosition != null) {
        _distanceM += Geolocator.distanceBetween(
          _lastPosition!.latitude, _lastPosition!.longitude,
          p.latitude, p.longitude,
        );
      }
      _lastPosition = p;
      _lastFixTime = now;
    });
  }

  void _reset() {
    setState(() {
      _speedKmh = 0;
      _instantKmh = 0;
      _maxSpeedKmh = 0;
      _distanceM = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final kmh = _speedKmh.clamp(0, maxDisplaySpeed);
    final fraction = (kmh / maxDisplaySpeed).clamp(0.0, 1.0);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Text('VELOCÍMETRO GPS',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        letterSpacing: 3,
                        color: Colors.white70,
                      )),
              const Spacer(),
              SizedBox(
                width: 320,
                height: 320,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CustomPaint(
                      size: const Size(320, 320),
                      painter: GaugePainter(fraction: fraction),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          kmh.toStringAsFixed(0),
                          style: const TextStyle(
                            fontSize: 72,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        const Text('km/h',
                            style: TextStyle(color: Colors.white54, fontSize: 18)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _running ? '● GPS activo' : '○ GPS inactivo',
                style: TextStyle(
                  color: _running ? const Color(0xFF00E5A0) : Colors.white38,
                  fontSize: 14,
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.redAccent)),
                ),
              if (_permissionDenied)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Column(
                    children: [
                      const Text('Permiso de ubicación denegado',
                          style: TextStyle(color: Colors.orangeAccent)),
                      TextButton(
                        onPressed: () async {
                          await Geolocator.openAppSettings();
                          setState(() => _permissionDenied = false);
                        },
                        child: const Text('Abrir ajustes'),
                      ),
                    ],
                  ),
                ),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _Stat(label: 'Máxima', value: '${_maxSpeedKmh.toStringAsFixed(0)} km/h'),
                  _Stat(label: 'Distancia', value: _formatDistance(_distanceM)),
                  _Stat(label: 'Actual', value: '${_instantKmh.toStringAsFixed(0)} km/h'),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ElevatedButton.icon(
                    onPressed: _running ? _stop : _start,
                    icon: Icon(_running ? Icons.stop : Icons.play_arrow),
                    label: Text(_running ? 'DETENER' : 'INICIAR'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _running ? Colors.redAccent : const Color(0xFF00E5A0),
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
                      textStyle: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 16),
                  OutlinedButton.icon(
                    onPressed: _reset,
                    icon: const Icon(Icons.restart_alt),
                    label: const Text('REINICIAR'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white70,
                      side: const BorderSide(color: Colors.white38),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDistance(double meters) {
    if (meters < 1000) return '${meters.toStringAsFixed(0)} m';
    return '${(meters / 1000).toStringAsFixed(2)} km';
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 12)),
        Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600)),
      ],
    );
  }
}

/// Dial de 240° (de 150° a 390°) con ticks cada 20 km/h.
class GaugePainter extends CustomPainter {
  final double fraction; // 0..1
  GaugePainter({required this.fraction});

  static const double startAngle = 150 * math.pi / 180;
  static const double sweep = 240 * math.pi / 180;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 18;
    const trackWidth = 14.0;

    final trackPaint = Paint()
      ..color = const Color(0xFF263238)
      ..style = PaintingStyle.stroke
      ..strokeWidth = trackWidth
      ..strokeCap = StrokeCap.round;

    final progressPaint = Paint()
      ..shader = const SweepGradient(
        startAngle: startAngle,
        endAngle: startAngle + sweep,
        colors: [Color(0xFF00E5A0), Color(0xFF00B8D4)],
        stops: [0.0, 1.0],
        transform: GradientRotation(0),
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = trackWidth
      ..strokeCap = StrokeCap.round;

    // Pista completa
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweep,
      false,
      trackPaint,
    );

    // Arco de progreso
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweep * fraction,
      false,
      progressPaint,
    );

    // Ticks y números cada 20 km/h
    final tickPaint = Paint()
      ..color = Colors.white38
      ..strokeWidth = 2;
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    for (int v = 0; v <= 200; v += 20) {
      final t = v / 200.0;
      final angle = startAngle + sweep * t;
      final isMajor = v % 40 == 0;

      final outer = Offset(
        center.dx + (radius + 6) * math.cos(angle),
        center.dy + (radius + 6) * math.sin(angle),
      );
      final inner = Offset(
        center.dx + (radius - (isMajor ? 14 : 8)) * math.cos(angle),
        center.dy + (radius - (isMajor ? 14 : 8)) * math.sin(angle),
      );
      canvas.drawLine(outer, inner, tickPaint);

      if (isMajor) {
        textPainter.text = TextSpan(
          text: '$v',
          style: const TextStyle(color: Colors.white54, fontSize: 13),
        );
        textPainter.layout();
        final labelPos = Offset(
          center.dx + (radius - 30) * math.cos(angle) - textPainter.width / 2,
          center.dy + (radius - 30) * math.sin(angle) - textPainter.height / 2,
        );
        textPainter.paint(canvas, labelPos);
      }
    }

    // Aguja
    final needleAngle = startAngle + sweep * fraction;
    final needlePaint = Paint()
      ..color = const Color(0xFF00E5A0)
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      center,
      Offset(
        center.dx + (radius - 24) * math.cos(needleAngle),
        center.dy + (radius - 24) * math.sin(needleAngle),
      ),
      needlePaint,
    );

    // Centro
    canvas.drawCircle(center, 8, Paint()..color = const Color(0xFF00E5A0));
    canvas.drawCircle(center, 4, Paint()..color = Colors.black87);
  }

  @override
  bool shouldRepaint(GaugePainter old) => old.fraction != fraction;
}
