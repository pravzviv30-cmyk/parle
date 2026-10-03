Pod::Spec.new do |s|
  s.name = 'LuvaniAudioLifecycle'
  s.version = '0.1.0'
  s.summary = 'Terminal audio interruption observation for Luvani Walk mode'
  s.description = s.summary
  s.license = { :type => 'Private' }
  s.author = 'Luvani'
  s.homepage = 'https://luvani.app'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
