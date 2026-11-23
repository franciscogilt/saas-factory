package com.example.saludos;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {
    @GetMapping("/api/hello")
    public Map<String, String> hello(@RequestParam(defaultValue = "mundo") String name) {
        return Map.of("message", "Hola, " + name);
    }
}
